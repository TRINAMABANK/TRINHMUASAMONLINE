import crypto from 'crypto';
import { query, queryOne, transaction } from '../config/database.js';

export async function createBatch(data, userId) {
  const id = crypto.randomUUID();
  const year = data.year || new Date().getFullYear();
  const res = await query(
    `INSERT INTO procurement_batches (id, batch_code, title, description, year, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, data.batch_code, data.title, data.description || null, year, 'OPEN', userId]
  );
  return res[0];
}

export async function getBatches() {
  return await query(`
    SELECT pb.*, u.full_name as created_by_name,
           (SELECT COUNT(*) FROM procurement_requests pr WHERE pr.batch_id = pb.id) as request_count
    FROM procurement_batches pb
    LEFT JOIN users u ON u.id = pb.created_by
    ORDER BY pb.created_at DESC
  `);
}

export async function getBatchById(id) {
  const batch = await queryOne(`
    SELECT pb.*, u.full_name as created_by_name
    FROM procurement_batches pb
    LEFT JOIN users u ON u.id = pb.created_by
    WHERE pb.id = $1
  `, [id]);

  if (!batch) return null;

  const requests = await query(`
    SELECT pr.*, u.full_name as requester_name
    FROM procurement_requests pr
    LEFT JOIN users u ON u.id = pr.requester_id
    WHERE pr.batch_id = $1
    ORDER BY pr.created_at DESC
  `, [id]);

  batch.requests = requests;
  return batch;
}

export async function createRequest(data, userId) {
  return await transaction(async (db) => {
    const reqId = crypto.randomUUID();
    const items = data.items || [];

    let totalAmount = 0;
    let hoiSoAmount = 0;
    let donViAmount = 0;

    for (const it of items) {
      const amt = Number(it.quantity || 1) * Number(it.unit_price || 0);
      totalAmount += amt;
      if (it.payment_group === 'HOI_SO') {
        hoiSoAmount += amt;
      } else {
        donViAmount += amt;
      }
    }

    const reqResult = await db.query(
      `INSERT INTO procurement_requests (
        id, batch_id, request_number, title, status, total_amount,
        hoi_so_amount, don_vi_amount, total_items, requester_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        reqId, data.batch_id || null, data.request_number, data.title,
        data.status || 'DRAFT', totalAmount, hoiSoAmount, donViAmount,
        items.length, userId, userId
      ]
    );

    // Thêm các dòng hàng
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const amt = Number(it.quantity || 1) * Number(it.unit_price || 0);
      await db.query(
        `INSERT INTO procurement_request_items (
          id, request_id, stt, department_id, department_name,
          supplier_id, supplier_name, item_name, spec, quantity,
          unit_price, amount, purpose, msp, payment_group
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          crypto.randomUUID(), reqId, i + 1, it.department_id || null, it.department_name,
          it.supplier_id || null, it.supplier_name, it.item_name, it.spec || null,
          it.quantity || 1, it.unit_price || 0, amt, it.purpose || null, it.msp || null,
          it.payment_group || 'CHUA_PHAN_LOAI'
        ]
      );
    }

    // Ghi lifecycle
    await db.query(
      `INSERT INTO lifecycle_events (id, entity_type, entity_id, event_type, old_status, new_status, actor_id, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [crypto.randomUUID(), 'REQUEST', reqId, 'REQUEST_CREATED', null, data.status || 'DRAFT', userId, 'Tạo mới hồ sơ trình ký']
    );

    return reqResult.rows[0];
  });
}

export async function getRequestById(id) {
  const req = await queryOne(`
    SELECT pr.*, pb.batch_code, pb.title as batch_title, u.full_name as requester_name
    FROM procurement_requests pr
    LEFT JOIN procurement_batches pb ON pb.id = pr.batch_id
    LEFT JOIN users u ON u.id = pr.requester_id
    WHERE pr.id = $1
  `, [id]);

  if (!req) return null;

  const items = await query(`
    SELECT pri.*, d.code as department_code, s.code as supplier_code
    FROM procurement_request_items pri
    LEFT JOIN departments d ON d.id = pri.department_id
    LEFT JOIN suppliers s ON s.id = pri.supplier_id
    WHERE pri.request_id = $1
    ORDER BY pri.stt ASC
  `, [id]);

  const approvalEvents = await query(`
    SELECT * FROM approval_events WHERE request_id = $1 ORDER BY decided_at DESC
  `, [id]);

  const generatedPos = await query(`
    SELECT po.id, po.po_number, po.supplier_name, po.status, po.total_amount, po.total_quantity
    FROM purchase_orders po
    WHERE po.request_id = $1
    ORDER BY po.po_number ASC
  `, [id]);

  req.items = items;
  req.approvalEvents = approvalEvents;
  req.generatedPos = generatedPos;
  return req;
}

export async function approveRequest(id, actor, comment = '') {
  return await transaction(async (db) => {
    const existing = await queryOne(`SELECT * FROM procurement_requests WHERE id = $1`, [id]);
    if (!existing) {
      throw new Error('Không tìm thấy hồ sơ trình ký.');
    }

    if (existing.status === 'APPROVED') {
      return existing; // Đã duyệt trước đó
    }

    const now = new Date();
    await db.query(`
      UPDATE procurement_requests
      SET status = 'APPROVED', approved_date = $1, updated_at = $1
      WHERE id = $2
    `, [now, id]);

    // Ghi sự kiện phê duyệt
    await db.query(`
      INSERT INTO approval_events (id, request_id, actor_id, actor_name, role, decision, comment, decided_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [crypto.randomUUID(), id, actor.id, actor.full_name, actor.role, 'APPROVE', comment || 'Lãnh đạo phê duyệt', now]);

    // Ghi lifecycle
    await db.query(`
      INSERT INTO lifecycle_events (id, entity_type, entity_id, event_type, old_status, new_status, actor_id, actor_name, event_at, note)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [crypto.randomUUID(), 'REQUEST', id, 'REQUEST_APPROVED', existing.status, 'APPROVED', actor.id, actor.full_name, now, comment]);

    return await queryOne(`SELECT * FROM procurement_requests WHERE id = $1`, [id]);
  });
}
