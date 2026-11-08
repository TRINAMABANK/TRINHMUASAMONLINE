import { Router } from 'express';
import { submitApproval, getApprovalHistory } from '../controllers/approvalController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = Router();

router.post('/:poId', authenticate, authorizeRoles('ADMIN', 'APPROVER', 'QTTS'), submitApproval);
router.get('/:poId', authenticate, getApprovalHistory);

export default router;
