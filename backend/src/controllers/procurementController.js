import { createBatch, getBatches, getBatchById, createRequest, getRequestById, approveRequest } from '../services/procurementService.js';

export async function createBatchHandler(req, res, next) {
  try {
    const batch = await createBatch(req.body, req.user.id);
    res.status(201).json({ success: true, message: 'Tạo đợt mua sắm thành công.', data: batch });
  } catch (err) {
    next(err);
  }
}

export async function getBatchesHandler(req, res, next) {
  try {
    const batches = await getBatches();
    res.json({ success: true, data: batches });
  } catch (err) {
    next(err);
  }
}

export async function getBatchByIdHandler(req, res, next) {
  try {
    const batch = await getBatchById(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Không tìm thấy đợt mua sắm.' });
    res.json({ success: true, data: batch });
  } catch (err) {
    next(err);
  }
}

export async function createRequestHandler(req, res, next) {
  try {
    const request = await createRequest(req.body, req.user.id);
    res.status(201).json({ success: true, message: 'Tạo hồ sơ trình ký thành công.', data: request });
  } catch (err) {
    next(err);
  }
}

export async function getRequestByIdHandler(req, res, next) {
  try {
    const request = await getRequestById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ trình ký.' });
    res.json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
}

export async function approveRequestHandler(req, res, next) {
  try {
    const updated = await approveRequest(req.params.id, req.user, req.body.comment);
    res.json({ success: true, message: 'Phê duyệt hồ sơ trình ký thành công.', data: updated });
  } catch (err) {
    next(err);
  }
}
