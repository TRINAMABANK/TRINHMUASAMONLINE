import crypto from 'crypto';
import { query, queryOne } from '../config/database.js';
import { logAudit } from '../middlewares/errorHandler.js';

export async function submitApproval(req, res, next) {
  try {
    const { poId } = req.params;
    const { action, comment } = req.body; // 'APPROVE' | 'REJECT' | 'REQUEST_CHANGE'

    const po = await queryOne('SELECT * FROM purchase_orders WHERE id = $1', [poId]);
    if (!po) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ PO.' });

    const approverName = req.user ? req.user.full_name : 'Lãnh đạo phê duyệt';
    const approverId = req.user ? req.user.id : null;

    const approvalId = `app_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await query(
      `INSERT INTO approval_histories (id, po_id, approver_id, approver_name, action, comment, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [approvalId, poId, approverId, approverName, action, comment || null]
    );

    let newSubmissionStatus = 'DA_DUYET';
    let newStage = 'DA_DUYET';

    if (action === 'REJECT') {
      newSubmissionStatus = 'BI_TU_CHOI';
      newStage = 'BI_TU_CHOI';
    } else if (action === 'REQUEST_CHANGE') {
      newSubmissionStatus = 'YEU_CAU_CHINH_SUA';
      newStage = 'CHO_XU_LY';
    }

    await query(
      `UPDATE purchase_orders 
       SET submission_status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [newSubmissionStatus, poId]
    );

    if (action === 'APPROVE') {
      await query(
        `UPDATE procurement_lifecycles 
         SET approved_at = CURRENT_TIMESTAMP, current_stage = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE po_id = $2`,
        [newStage, poId]
      );
    }

    // Ghi sự kiện
    const evId = `ev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await query(
      `INSERT INTO lifecycle_events (id, po_id, object_type, object_id, previous_status, new_status, actor_id, actor_name, actor_role, event_time, note)
       VALUES ($1, $2, 'APPROVAL', $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9)`,
      [
        evId,
        poId,
        approvalId,
        po.submission_status,
        newSubmissionStatus,
        approverId,
        approverName,
        req.user?.role || 'APPROVER',
        `${approverName} đã ${action === 'APPROVE' ? 'PHÊ DUYỆT' : action === 'REJECT' ? 'TỪ CHỐI' : 'YÊU CẦU CHỈNH SỬA'} hồ sơ. Ý kiến: ${comment || 'Không có ghi chú'}`
      ]
    );

    await logAudit(approverId, approverName, req.user?.role, 'APPROVAL', 'PURCHASE_ORDER', poId, { status: po.submission_status }, { status: newSubmissionStatus });

    res.json({
      success: true,
      message: `Đã xử lý phê duyệt thành công: ${action}`,
      data: { po_id: poId, submission_status: newSubmissionStatus }
    });
  } catch (err) {
    next(err);
  }
}

export async function getApprovalHistory(req, res, next) {
  try {
    const { poId } = req.params;
    const history = await query(
      `SELECT * FROM approval_histories WHERE po_id = $1 ORDER BY created_at DESC`,
      [poId]
    );
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
}
