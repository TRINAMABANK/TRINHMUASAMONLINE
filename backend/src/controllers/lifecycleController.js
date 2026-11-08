import { calculatePoTimeline, getDashboardKPIs } from '../services/lifecycleService.js';

export async function getDashboardStats(req, res, next) {
  try {
    const filters = {
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      department_id: req.query.department_id,
      supplier_id: req.query.supplier_id
    };

    const data = await getDashboardKPIs(filters, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getPoLifecycleTimeline(req, res, next) {
  try {
    const { poId } = req.params;
    const timeline = await calculatePoTimeline(poId);
    if (!timeline) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin vòng đời của PO.' });
    }
    res.json({ success: true, data: timeline });
  } catch (err) {
    next(err);
  }
}
