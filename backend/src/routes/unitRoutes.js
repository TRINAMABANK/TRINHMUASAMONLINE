import express from 'express';
import { getUnitsHandler, getUnitPurchaseItemsHandler, getUnitPurchaseTimelineHandler } from '../controllers/unitController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.get('/units', authenticate, getUnitsHandler);
router.get('/units/:id/purchase-items', authenticate, getUnitPurchaseItemsHandler);
router.get('/units/:id/purchase-timeline', authenticate, getUnitPurchaseTimelineHandler);

export default router;
