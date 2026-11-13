import {
  getUnitsList,
  getUnitDashboardStats,
  getUnitSearchItems,
  confirmUnitReceipt
} from '../services/unitService.js';

export async function getUnitsHandler(req, res, next) {
  try {
    const data = await getUnitsList();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getUnitDashboardStatsHandler(req, res, next) {
  try {
    const unitId = req.query.unit_id || req.params.id;
    const data = await getUnitDashboardStats(unitId, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getUnitSearchItemsHandler(req, res, next) {
  try {
    const filters = {
      unit_id: req.query.unit_id || req.params.id,
      q: req.query.q,
      item_name: req.query.item_name,
      po_number: req.query.po_number,
      request_date: req.query.request_date,
      supplier_name: req.query.supplier_name,
      submission_status: req.query.submission_status,
      delivery_status: req.query.delivery_status
    };

    const data = await getUnitSearchItems(filters, req.user);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
}

export async function confirmUnitReceiptHandler(req, res, next) {
  try {
    const result = await confirmUnitReceipt(req.body, req.user);
    res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
}
