import express from 'express';
import { getMasterPoReportHandler, getUnitProcurementReportHandler, getSupplierPerformanceReportHandler } from '../controllers/reportController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = express.Router();

router.get('/reports/master-po', authenticate, authorizeRoles('ADMIN', 'QTTS'), getMasterPoReportHandler);
router.get('/reports/unit-procurement', authenticate, authorizeRoles('ADMIN', 'QTTS'), getUnitProcurementReportHandler);
router.get('/reports/supplier-performance', authenticate, authorizeRoles('ADMIN', 'QTTS'), getSupplierPerformanceReportHandler);

export default router;
