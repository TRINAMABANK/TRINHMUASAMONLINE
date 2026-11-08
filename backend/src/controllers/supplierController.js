import { getSupplierPurchaseOrders, confirmSupplierPo, createSupplierDelivery } from '../services/supplierService.js';
import { logAudit } from '../middlewares/errorHandler.js';

export async function getSupplierPOsHandler(req, res, next) {
  try {
    const data = await getSupplierPurchaseOrders(req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function confirmSupplierPOHandler(req, res, next) {
  try {
    const { expected_delivery_date, note } = req.body;
    const po = await confirmSupplierPo(req.params.id, expected_delivery_date, req.user, note);
    await logAudit(req.user.id, req.user.full_name, req.user.role, 'CONFIRM_PO', 'PURCHASE_ORDER', req.params.id, null, { expected_delivery_date }, req.ip);
    res.json({ success: true, message: 'Xác nhận đơn hàng thành công.', data: po });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
}

export async function createSupplierDeliveryHandler(req, res, next) {
  try {
    const delivery = await createSupplierDelivery(req.body, req.user);
    await logAudit(req.user.id, req.user.full_name, req.user.role, 'CREATE_DELIVERY', 'DELIVERY', delivery.id, null, req.body, req.ip);
    res.status(201).json({ success: true, message: 'Tạo đợt giao hàng thành công.', data: delivery });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
}
