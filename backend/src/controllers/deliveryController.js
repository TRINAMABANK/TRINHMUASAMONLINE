import {
  confirmVendorOrder,
  updateExpectedDeliveryDate,
  dispatchVendorDelivery
} from '../services/deliveryService.js';
import { query } from '../config/database.js';

export async function confirmOrder(req, res, next) {
  try {
    const { poId } = req.params;
    const { notes } = req.body;
    const result = await confirmVendorOrder(poId, notes, req.user);
    res.json({ success: true, message: result.message });
  } catch (err) {
    next(err);
  }
}

export async function updateExpectedDate(req, res, next) {
  try {
    const { poId } = req.params;
    const { expected_date, reason } = req.body;
    if (!expected_date) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ngày dự kiến giao hàng.' });
    }
    const result = await updateExpectedDeliveryDate(poId, expected_date, reason, req.user);
    res.json({ success: true, message: result.message });
  } catch (err) {
    next(err);
  }
}

export async function dispatchDelivery(req, res, next) {
  try {
    const { poId } = req.params;
    const result = await dispatchVendorDelivery(poId, req.body, req.user);
    res.status(201).json({
      success: true,
      message: `Đã xác nhận giao hàng thành công! Mã đợt: ${result.delivery_code}`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function getExpectedDateHistory(req, res, next) {
  try {
    const { poId } = req.params;
    const history = await query(
      `SELECT ed.*, u.full_name as changed_by_name, u.role as changed_by_role
       FROM expected_delivery_dates ed
       LEFT JOIN users u ON ed.changed_by_user_id = u.id
       WHERE ed.po_id = $1
       ORDER BY ed.created_at DESC`,
      [poId]
    );
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
}
