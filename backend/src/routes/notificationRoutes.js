import { Router } from 'express';
import { getNotifications, markNotificationRead, getAuditLogs } from '../controllers/notificationController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, getNotifications);
router.put('/:id/read', authenticate, markNotificationRead);
router.get('/audit-logs', authenticate, authorizeRoles('ADMIN', 'QTTS'), getAuditLogs);

export default router;
