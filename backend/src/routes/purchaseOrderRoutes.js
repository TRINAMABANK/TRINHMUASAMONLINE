import { Router } from 'express';
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  acceptPaymentBatch
} from '../controllers/purchaseOrderController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, getPurchaseOrders);
router.get('/:id', authenticate, getPurchaseOrderById);
router.post('/', authenticate, authorizeRoles('ADMIN', 'QTTS', 'HCQT', 'PURCHASING'), createPurchaseOrder);
router.put('/:id', authenticate, authorizeRoles('ADMIN', 'QTTS', 'HCQT', 'PURCHASING', 'APPROVER'), updatePurchaseOrder);
router.delete('/:id', authenticate, authorizeRoles('ADMIN', 'QTTS'), deletePurchaseOrder);

// Nghiệp vụ ACCEPT phân loại thanh toán bù trừ
router.post('/payment-batches/accept', authenticate, authorizeRoles('ADMIN', 'QTTS', 'HCQT', 'REVIEWER'), acceptPaymentBatch);

export default router;
