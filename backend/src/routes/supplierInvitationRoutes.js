import express from 'express';
import {
  generateInvitationHandler,
  confirmInvitationSentHandler,
  resendInvitationHandler,
  revokeInvitationHandler,
  getPoSupplierManagementHandler,
  portalAccessHandler,
  portalConfirmPoHandler,
  portalDispatchDeliveryHandler
} from '../controllers/supplierInvitationController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = express.Router();

// 1. Tuyến dành cho Quản trị viên (Master PO Management)
router.post('/supplier-invitations/generate', authenticate, authorizeRoles('ADMIN', 'QTTS'), generateInvitationHandler);
router.post('/supplier-invitations/:id/confirm-sent', authenticate, authorizeRoles('ADMIN', 'QTTS'), confirmInvitationSentHandler);
router.post('/supplier-invitations/:id/resend', authenticate, authorizeRoles('ADMIN', 'QTTS'), resendInvitationHandler);
router.post('/supplier-invitations/:id/revoke', authenticate, authorizeRoles('ADMIN', 'QTTS'), revokeInvitationHandler);
router.get('/purchase-orders/:id/supplier-invitations', authenticate, authorizeRoles('ADMIN', 'QTTS', 'VIEWER'), getPoSupplierManagementHandler);

// 2. Tuyến Cổng Đối Tác (Bảo mật qua Secure Token - không yêu cầu session đăng nhập admin)
router.get('/supplier-portal/access/:token', portalAccessHandler);
router.post('/supplier-portal/confirm/:token', portalConfirmPoHandler);
router.post('/supplier-portal/dispatch/:token', portalDispatchDeliveryHandler);

export default router;
