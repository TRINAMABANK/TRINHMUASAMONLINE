import express from 'express';
import {
  getUnitsHandler,
  getUnitDashboardStatsHandler,
  getUnitSearchItemsHandler,
  confirmUnitReceiptHandler
} from '../controllers/unitController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = express.Router();

router.get('/units', authenticate, getUnitsHandler);
router.get('/units/dashboard-stats', authenticate, getUnitDashboardStatsHandler);
router.get('/units/search-items', authenticate, getUnitSearchItemsHandler);
router.get('/units/:id/purchase-items', authenticate, getUnitSearchItemsHandler);
router.post('/units/confirm-receipt', authenticate, authorizeRoles('ADMIN', 'QTTS', 'UNIT_USER', 'DON_VI'), confirmUnitReceiptHandler);

export default router;
