import { Router } from 'express';
import { getDashboardStats, getPoLifecycleTimeline } from '../controllers/lifecycleController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/dashboard/kpis', authenticate, getDashboardStats);
router.get('/:poId/timeline', authenticate, getPoLifecycleTimeline);

export default router;
