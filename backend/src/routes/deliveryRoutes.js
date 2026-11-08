import { Router } from 'express';
import {
  confirmOrder,
  updateExpectedDate,
  dispatchDelivery,
  getExpectedDateHistory
} from '../controllers/deliveryController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = Router();

router.post('/:poId/confirm-order', authenticate, authorizeRoles('ADMIN', 'QTTS', 'SUPPLIER'), confirmOrder);
router.post('/:poId/expected-date', authenticate, authorizeRoles('ADMIN', 'QTTS', 'SUPPLIER'), updateExpectedDate);
router.get('/:poId/expected-date/history', authenticate, getExpectedDateHistory);
router.post('/:poId/dispatch', authenticate, authorizeRoles('ADMIN', 'QTTS', 'SUPPLIER'), dispatchDelivery);

export default router;
