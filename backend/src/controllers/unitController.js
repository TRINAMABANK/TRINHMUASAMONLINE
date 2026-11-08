import { getUnitsList, getUnitPurchaseItems, getUnitPurchaseTimeline } from '../services/unitService.js';

export async function getUnitsHandler(req, res, next) {
  try {
    const data = await getUnitsList();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getUnitPurchaseItemsHandler(req, res, next) {
  try {
    const data = await getUnitPurchaseItems(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
}

export async function getUnitPurchaseTimelineHandler(req, res, next) {
  try {
    const data = await getUnitPurchaseTimeline(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
}
