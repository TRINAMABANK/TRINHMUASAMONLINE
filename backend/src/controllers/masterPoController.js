import {
  generatePurchaseOrders,
  getMasterPOsList,
  getPurchaseOrderDetail,
  getPurchaseOrderItems,
  getPurchaseOrderAllocations
} from '../services/masterPoService.js';
import { logAudit } from '../middlewares/errorHandler.js';

export async function generatePoHandler(req, res, next) {
  try {
    const { request_id } = req.body;
    if (!request_id) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp request_id của hồ sơ cần sinh PO.' });
    }

    const pos = await generatePurchaseOrders(request_id, req.user);
    await logAudit(req.user.id, req.user.full_name, req.user.role, 'GENERATE_PO', 'PURCHASE_ORDER', request_id, null, { po_count: pos.length }, req.ip);

    res.status(201).json({
      success: true,
      message: `Đã sinh thành công ${pos.length} Purchase Order(s) theo từng nhà cung cấp.`,
      data: pos
    });
  } catch (err) {
    next(err);
  }
}

export async function getMasterPOsHandler(req, res, next) {
  try {
    const filters = {
      po_number: req.query.po_number,
      supplier_id: req.query.supplier_id,
      supplier_name: req.query.supplier_name,
      item_name: req.query.item_name,
      department_id: req.query.department_id,
      unit_name: req.query.unit_name,
      status: req.query.status,
      payment_group: req.query.payment_group,
      from_date: req.query.from_date,
      to_date: req.query.to_date
    };

    const data = await getMasterPOsList(filters, req.user);
    res.json({
      success: true,
      total: data.length,
      data
    });
  } catch (err) {
    next(err);
  }
}

export async function getPurchaseOrderDetailHandler(req, res, next) {
  try {
    const po = await getPurchaseOrderDetail(req.params.id, req.user);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Purchase Order.' });
    }
    res.json({ success: true, data: po });
  } catch (err) {
    next(err);
  }
}

export async function getPurchaseOrderItemsHandler(req, res, next) {
  try {
    const items = await getPurchaseOrderItems(req.params.id);
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

export async function getPurchaseOrderAllocationsHandler(req, res, next) {
  try {
    const allocations = await getPurchaseOrderAllocations(req.params.id);
    res.json({ success: true, data: allocations });
  } catch (err) {
    next(err);
  }
}
