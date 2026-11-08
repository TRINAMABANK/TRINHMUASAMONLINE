import express from 'express';
import {
  generatePoHandler,
  getMasterPOsHandler,
  getPurchaseOrderDetailHandler,
  getPurchaseOrderItemsHandler,
  getPurchaseOrderAllocationsHandler
} from '../controllers/masterPoController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = express.Router();

// Sinh PO theo NCC
router.post('/purchase-orders/generate', authenticate, authorizeRoles('ADMIN', 'QTTS'), generatePoHandler);

// Sổ Master PO
router.get('/master-pos', authenticate, getMasterPOsHandler);

// Chi tiết PO và danh mục con
router.get('/purchase-orders/:id', authenticate, getPurchaseOrderDetailHandler);
router.get('/purchase-orders/:id/items', authenticate, getPurchaseOrderItemsHandler);
router.get('/purchase-orders/:id/allocations', authenticate, getPurchaseOrderAllocationsHandler);

export default router;
