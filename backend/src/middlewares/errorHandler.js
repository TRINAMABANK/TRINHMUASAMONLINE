import { query } from '../config/database.js';
import crypto from 'crypto';

export function errorHandler(err, req, res, next) {
  console.error('[Error Handler]', err);

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Lỗi hệ thống máy chủ nội bộ.';

  res.status(status).json({
    success: false,
    message,
    errors: err.errors || undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

export async function logAudit(userId, userName, userRole, action, entity, entityId = null, oldValues = null, newValues = null, ipAddress = null) {
  try {
    const id = `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    await query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity, entity_id, old_values, new_values, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
      [
        id,
        userId,
        userName,
        userRole,
        action,
        entity,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress
      ]
    );
  } catch (e) {
    console.error('[Audit Log Error]', e);
  }
}
