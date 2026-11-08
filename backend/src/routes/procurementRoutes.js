import express from 'express';
import {
  createBatchHandler, getBatchesHandler, getBatchByIdHandler,
  createRequestHandler, getRequestByIdHandler, approveRequestHandler
} from '../controllers/procurementController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = express.Router();

// Procurement Batches
router.post('/procurement-batches', authenticate, authorizeRoles('ADMIN', 'QTTS'), createBatchHandler);
router.get('/procurement-batches', authenticate, getBatchesHandler);
router.get('/procurement-batches/:id', authenticate, getBatchByIdHandler);

// Procurement Requests
router.post('/procurement-requests', authenticate, authorizeRoles('ADMIN', 'QTTS'), createRequestHandler);
router.get('/procurement-requests/:id', authenticate, getRequestByIdHandler);
router.post('/procurement-requests/:id/approve', authenticate, authorizeRoles('ADMIN', 'APPROVER'), approveRequestHandler);

export default router;
