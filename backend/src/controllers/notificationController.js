import { query } from '../config/database.js';

export async function getNotifications(req, res, next) {
  try {
    const role = req.user ? req.user.role : null;
    const userId = req.user ? req.user.id : null;

    const notifs = await query(
      `SELECT * FROM notifications 
       WHERE (user_id = $1 OR target_role = $2 OR target_role IS NULL)
       ORDER BY created_at DESC LIMIT 50`,
      [userId, role]
    );

    res.json({ success: true, count: notifs.length, data: notifs });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const { id } = req.params;
    await query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
    res.json({ success: true, message: 'Đã đánh dấu đã đọc.' });
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogs(req, res, next) {
  try {
    const logs = await query(
      `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`
    );
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    next(err);
  }
}
