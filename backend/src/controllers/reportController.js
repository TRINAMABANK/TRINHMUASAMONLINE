import { getMasterPoReport, getUnitProcurementReport, getSupplierPerformanceReport } from '../services/reportService.js';

export async function getMasterPoReportHandler(req, res, next) {
  try {
    const data = await getMasterPoReport();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getUnitProcurementReportHandler(req, res, next) {
  try {
    const data = await getUnitProcurementReport();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSupplierPerformanceReportHandler(req, res, next) {
  try {
    const data = await getSupplierPerformanceReport();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
