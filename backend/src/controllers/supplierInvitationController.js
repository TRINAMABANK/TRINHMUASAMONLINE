import {
  generateInvitation,
  confirmInvitationSent,
  resendInvitation,
  revokeInvitation,
  getPoSupplierManagement,
  verifyAndGetPortalData,
  portalConfirmPo,
  portalDispatchDelivery
} from '../services/supplierInvitationService.js';
import { logAudit } from '../middlewares/errorHandler.js';

// ==========================================
// API DÀNH CHO ADMIN QUẢN TRỊ MASTER PO
// ==========================================

export async function generateInvitationHandler(req, res, next) {
  try {
    const { poId, supplierId, recipientEmail, baseUrl } = req.body;
    if (!poId || !supplierId) {
      return res.status(400).json({ success: false, message: 'Thiếu poId hoặc supplierId.' });
    }

    const hostHeader = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const result = await generateInvitation({
      poId,
      supplierId,
      recipientEmail,
      currentUser: req.user,
      baseUrl: baseUrl || hostHeader
    });

    await logAudit(req.user.id, req.user.full_name, req.user.role, 'GENERATE_LINK', 'PURCHASE_ORDER', poId, null, { supplierId, recipientEmail: result.recipientEmail }, req.ip);

    res.json({
      success: true,
      message: 'Tạo đường link riêng và bản nháp email đặt hàng thành công.',
      data: result
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
}

export async function confirmInvitationSentHandler(req, res, next) {
  try {
    const { id } = req.params;
    const result = await confirmInvitationSent({ invitationId: id, currentUser: req.user });
    await logAudit(req.user.id, req.user.full_name, req.user.role, 'CONFIRM_EMAIL_SENT', 'SUPPLIER_INVITATION', id, null, null, req.ip);
    res.json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
}

export async function resendInvitationHandler(req, res, next) {
  try {
    const { id } = req.params;
    const hostHeader = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const result = await resendInvitation({ invitationId: id, currentUser: req.user, baseUrl: hostHeader });
    await logAudit(req.user.id, req.user.full_name, req.user.role, 'RESEND_LINK', 'SUPPLIER_INVITATION', id, null, null, req.ip);
    res.json({ success: true, message: 'Đã gia hạn và tạo lại liên kết đối tác thành công.', data: result });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
}

export async function revokeInvitationHandler(req, res, next) {
  try {
    const { id } = req.params;
    const result = await revokeInvitation({ invitationId: id, currentUser: req.user });
    await logAudit(req.user.id, req.user.full_name, req.user.role, 'REVOKE_LINK', 'SUPPLIER_INVITATION', id, null, null, req.ip);
    res.json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
}

export async function getPoSupplierManagementHandler(req, res, next) {
  try {
    const { id } = req.params;
    const data = await getPoSupplierManagement(id);
    if (!data) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin đơn hàng.' });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// API DÀNH CHO CỔNG ĐỐI TÁC (PUBLIC QUA TOKEN)
// ==========================================

export async function portalAccessHandler(req, res, next) {
  try {
    const { token } = req.params;
    const data = await verifyAndGetPortalData(token);
    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    res.status(403).json({ success: false, message: err.message });
  }
}

export async function portalConfirmPoHandler(req, res, next) {
  try {
    const { token } = req.params;
    const { expected_delivery_date, note, confirmed_by_name } = req.body;
    const result = await portalConfirmPo({
      rawToken: token,
      expectedDeliveryDate: expected_delivery_date,
      note,
      confirmedByName: confirmed_by_name,
      clientIp: req.ip
    });
    res.json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function portalDispatchDeliveryHandler(req, res, next) {
  try {
    const { token } = req.params;
    const {
      dispatched_at,
      delivered_items,
      delivery_note,
      tracking_number,
      carrier,
      confirmed_by_name,
      attachment_id
    } = req.body;

    const result = await portalDispatchDelivery({
      rawToken: token,
      dispatchedAt: dispatched_at,
      deliveredItems: delivered_items,
      deliveryNote: delivery_note,
      trackingNumber: tracking_number,
      carrier,
      confirmedByName: confirmed_by_name,
      attachmentId: attachment_id,
      clientIp: req.ip
    });
    res.json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    res.status(400).json({ success: false, message: err.message });
  }
}
