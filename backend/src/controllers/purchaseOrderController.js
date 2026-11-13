import {
  getPurchaseOrdersList,
  getPurchaseOrderDetail,
  createPurchaseOrderRecord,
  acceptClassificationBatch,
  submitPOForApproval,
  approvePO,
  rejectPO,
  orderPO,
  recordDelivery,
  recordReceipt
} from '../services/poService.js';
import { query } from '../config/database.js';

export async function getPurchaseOrders(req, res, next) {
  try {
    const filters = {
      q: req.query.q,
      po_number: req.query.po_number,
      requester: req.query.requester,
      item_name: req.query.item_name,
      unit_name: req.query.unit_name,
      supplier_name: req.query.supplier_name,
      status: req.query.status,
      submission_status: req.query.submission_status,
      po_status: req.query.po_status,
      delivery_status: req.query.delivery_status,
      from_date: req.query.from_date,
      to_date: req.query.to_date
    };

    const pos = await getPurchaseOrdersList(filters, req.user);
    res.json({ success: true, count: pos.length, data: pos });
  } catch (err) {
    next(err);
  }
}

export async function getPurchaseOrderById(req, res, next) {
  try {
    const { id } = req.params;
    const po = await getPurchaseOrderDetail(id, req.user);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ PO.' });
    }
    res.json({ success: true, data: po });
  } catch (err) {
    next(err);
  }
}

export async function createPurchaseOrder(req, res, next) {
  try {
    const po = await createPurchaseOrderRecord(req.body, req.user);
    res.status(201).json({
      success: true,
      message: `Đã khởi tạo thành công hồ sơ PO: ${po.po_number}`,
      data: po
    });
  } catch (err) {
    next(err);
  }
}

export async function updatePurchaseOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { note, requester, status, submission_status, po_status, delivery_status } = req.body;

    const po = await getPurchaseOrderDetail(id);
    if (!po) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ PO.' });

    await query(
      `UPDATE purchase_orders 
       SET note = COALESCE($1, note),
           requester_name = COALESCE($2, requester_name),
           submission_status = COALESCE($3, submission_status),
           po_status = COALESCE($4, po_status),
           delivery_status = COALESCE($5, delivery_status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [note, requester, submission_status, po_status, delivery_status, po.id]
    );

    const updated = await getPurchaseOrderDetail(po.id);
    res.json({ success: true, message: 'Cập nhật hồ sơ thành công.', data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deletePurchaseOrder(req, res, next) {
  try {
    const { id } = req.params;
    const po = await getPurchaseOrderDetail(id);
    if (!po) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ PO.' });

    // Không cho phép xóa PO đã hoàn tất hoặc đã duyệt
    if (po.submission_status === 'DA_DUYET' || po.po_status === 'HOAN_TAT') {
      return res.status(400).json({
        success: false,
        message: 'Hồ sơ đã được phê duyệt hoặc đã hoàn tất, không thể xóa trực tiếp. Vui lòng làm thủ tục hủy nếu cần.'
      });
    }

    await query('DELETE FROM purchase_orders WHERE id = $1', [po.id]);
    res.json({ success: true, message: `Đã xóa thành công hồ sơ PO: ${po.po_number}` });
  } catch (err) {
    next(err);
  }
}

export async function submitApprovalHandler(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await submitPOForApproval(id, req.user);
    res.json({
      success: true,
      message: `Đã gửi trình ký hồ sơ ${updated.po_number} thành công.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

export async function approvePoHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const updated = await approvePO(id, comment, req.user);
    res.json({
      success: true,
      message: `Đã phê duyệt hồ sơ ${updated.po_number} thành công.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

export async function rejectPoHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const updated = await rejectPO(id, reason, req.user);
    res.json({
      success: true,
      message: `Đã từ chối/trả lại hồ sơ ${updated.po_number}.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

export async function orderPoHandler(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await orderPO(id, req.body, req.user);
    res.json({
      success: true,
      message: `Đã phát hành đơn đặt hàng cho hồ sơ ${updated.po_number}.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

export async function deliverPoHandler(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await recordDelivery(id, req.body, req.user);
    res.json({
      success: true,
      message: `Đã ghi nhận đợt giao hàng cho hồ sơ ${updated.po_number}.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

export async function receiptPoHandler(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await recordReceipt(id, req.body, req.user);
    res.json({
      success: true,
      message: `Đã xác nhận nhận hàng thành công.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

export async function acceptPaymentBatch(req, res, next) {
  try {
    const { po_id, chosen_type, selected_item_ids } = req.body;
    if (!po_id || !chosen_type) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin po_id hoặc chosen_type.' });
    }

    const updated = await acceptClassificationBatch(po_id, chosen_type, selected_item_ids, req.user);
    res.json({
      success: true,
      message: 'ACCEPT phân loại thanh toán thành công!',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}
