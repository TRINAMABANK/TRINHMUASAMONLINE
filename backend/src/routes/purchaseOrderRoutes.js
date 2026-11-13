import { Router } from 'express';
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  acceptPaymentBatch,
  submitApprovalHandler,
  approvePoHandler,
  rejectPoHandler,
  orderPoHandler,
  deliverPoHandler,
  receiptPoHandler
} from '../controllers/purchaseOrderController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, getPurchaseOrders);
router.get('/:id', authenticate, getPurchaseOrderById);
router.post('/', authenticate, authorizeRoles('ADMIN', 'QTTS', 'HCQT', 'PURCHASING'), createPurchaseOrder);
router.put('/:id', authenticate, authorizeRoles('ADMIN', 'QTTS', 'HCQT', 'PURCHASING', 'APPROVER'), updatePurchaseOrder);
router.delete('/:id', authenticate, authorizeRoles('ADMIN', 'QTTS'), deletePurchaseOrder);

// Các hành động quy trình vòng đời chuẩn Section III & VI
router.post('/:id/submit', authenticate, authorizeRoles('ADMIN', 'QTTS', 'HCQT'), submitApprovalHandler);
router.post('/:id/approve', authenticate, authorizeRoles('ADMIN', 'APPROVER', 'QTTS'), approvePoHandler);
router.post('/:id/reject', authenticate, authorizeRoles('ADMIN', 'APPROVER', 'QTTS'), rejectPoHandler);
router.post('/:id/order', authenticate, authorizeRoles('ADMIN', 'QTTS', 'HCQT'), orderPoHandler);
router.post('/:id/deliver', authenticate, authorizeRoles('ADMIN', 'QTTS', 'SUPPLIER'), deliverPoHandler);
router.post('/:id/receipt', authenticate, authorizeRoles('ADMIN', 'QTTS', 'UNIT_USER', 'DON_VI'), receiptPoHandler);

// Nghiệp vụ ACCEPT phân loại thanh toán bù trừ
router.post('/payment-batches/accept', authenticate, authorizeRoles('ADMIN', 'QTTS', 'HCQT', 'REVIEWER'), acceptPaymentBatch);

export default router;
