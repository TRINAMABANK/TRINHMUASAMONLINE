import { createReceiptConfirmation, getReceiptConfirmationDetail } from '../services/receiptService.js';
import { logAudit } from '../middlewares/errorHandler.js';

export async function createReceiptHandler(req, res, next) {
  try {
    const receipt = await createReceiptConfirmation(req.body, req.user);
    await logAudit(req.user.id, req.user.full_name, req.user.role, 'CREATE_RECEIPT', 'RECEIPT', receipt.id, null, req.body, req.ip);
    res.status(201).json({ success: true, message: 'Xác nhận nhận hàng thành công.', data: receipt });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    next(err);
  }
}

export async function getReceiptDetailHandler(req, res, next) {
  try {
    const receipt = await getReceiptConfirmationDetail(req.params.id);
    if (!receipt) return res.status(404).json({ success: false, message: 'Không tìm thấy biên bản nhận hàng.' });
    res.json({ success: true, data: receipt });
  } catch (err) {
    next(err);
  }
}
