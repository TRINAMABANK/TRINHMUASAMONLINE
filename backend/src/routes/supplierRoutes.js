import express from 'express';
import { getSupplierPOsHandler, confirmSupplierPOHandler, createSupplierDeliveryHandler } from '../controllers/supplierController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = express.Router();

router.get('/supplier/purchase-orders', authenticate, authorizeRoles('ADMIN', 'SUPPLIER', 'QTTS'), getSupplierPOsHandler);
router.post('/supplier/purchase-orders/:id/confirm', authenticate, authorizeRoles('ADMIN', 'SUPPLIER'), confirmSupplierPOHandler);
router.post('/supplier/deliveries', authenticate, authorizeRoles('ADMIN', 'SUPPLIER'), createSupplierDeliveryHandler);

export default router;
