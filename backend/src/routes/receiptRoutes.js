import express from 'express';
import { createReceiptHandler, getReceiptDetailHandler } from '../controllers/receiptController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = express.Router();

router.post('/receipts', authenticate, authorizeRoles('ADMIN', 'DON_VI', 'QTTS'), createReceiptHandler);
router.get('/receipts/:id', authenticate, getReceiptDetailHandler);

export default router;
