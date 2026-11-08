import crypto from 'crypto';
import { query, queryOne, transaction } from '../config/database.js';

export async function createReceiptConfirmation(receiptData, currentUser) {
  return await transaction(async (db) => {
    const { po_id, delivery_id, department_id, condition_note, items = [] } = receiptData;

    // RBAC: Đơn vị chỉ được xác nhận hàng thuộc đơn vị mình
    const targetDeptId = department_id || currentUser.department_id;
    if (currentUser.roles.includes('DON_VI')) {
      if (currentUser.department_id !== targetDeptId) {
        const err = new Error('Truy cập bị từ chối: Bạn chỉ có quyền xác nhận nhận hàng cho đơn vị của mình.');
        err.statusCode = 403;
        throw err;
      }
    }

    const recId = crypto.randomUUID();
    const recCode = `REC-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    const now = new Date();

    let hasDamageOrMissing = false;
    let totalQtyReceivedInBatch = 0;

    for (const it of items) {
      const qRec = Number(it.quantity_received || 0);
      const qDam = Number(it.quantity_damaged || 0);
      const qMis = Number(it.quantity_missing || 0);

      totalQtyReceivedInBatch += qRec;
      if (qDam > 0 || qMis > 0) hasDamageOrMissing = true;
    }

    const receiptStatus = hasDamageOrMissing ? 'DISCREPANCY' : 'RECEIVED';

    await db.query(`
      INSERT INTO receipt_confirmations (
        id, receipt_code, po_id, delivery_id, department_id, received_date,
        status, receiver_name, receiver_id, condition_note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      recId, recCode, po_id || null, delivery_id || null, targetDeptId,
      now, receiptStatus, currentUser.full_name, currentUser.id, condition_note || null
    ]);

    for (const it of items) {
      const qRec = Number(it.quantity_received || 0);
      const qDam = Number(it.quantity_damaged || 0);
      const qMis = Number(it.quantity_missing || 0);

      await db.query(`
        INSERT INTO receipt_confirmation_items (
          id, receipt_id, po_item_id, allocation_id, quantity_received,
          quantity_damaged, quantity_missing, discrepancy_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        crypto.randomUUID(), recId, it.po_item_id || null, it.allocation_id || null,
        qRec, qDam, qMis, it.discrepancy_reason || null
      ]);

      // Cập nhật po_item_allocations
      if (it.allocation_id) {
        const alloc = await queryOne(`SELECT * FROM po_item_allocations WHERE id = $1`, [it.allocation_id]);
        if (alloc) {
          const newRecQty = Number(alloc.received_quantity) + qRec;
          let newAllocStatus = 'PARTIALLY_RECEIVED';
          if (newRecQty >= Number(alloc.allocated_quantity) && qDam === 0 && qMis === 0) {
            newAllocStatus = 'COMPLETED';
          }

          await db.query(`
            UPDATE po_item_allocations
            SET received_quantity = $1,
                status = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
          `, [newRecQty, newAllocStatus, it.allocation_id]);
        }
      }

      // Cập nhật purchase_order_items
      if (it.po_item_id) {
        await db.query(`
          UPDATE purchase_order_items
          SET received_quantity = received_quantity + $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [qRec, it.po_item_id]);
      }
    }

    // Cập nhật trạng thái Purchase Order nếu có po_id
    if (po_id) {
      const po = await queryOne(`SELECT * FROM purchase_orders WHERE id = $1`, [po_id]);
      if (po) {
        const sumRecRes = await db.query(`
          SELECT COALESCE(SUM(quantity_received), 0) as total_received
          FROM receipt_confirmation_items rci
          JOIN receipt_confirmations rc ON rc.id = rci.receipt_id
          WHERE rc.po_id = $1
        `, [po_id]);

        const totalReceived = Number(sumRecRes.rows[0].total_received || 0);

        // Kiểm tra xem tất cả phân bổ đã hoàn tất chưa
        const pendingAllocRes = await db.query(`
          SELECT COUNT(*) as pending_count
          FROM po_item_allocations
          WHERE po_id = $1 AND (status != 'COMPLETED' OR received_quantity < allocated_quantity)
        `, [po_id]);

        const isFullyDone = Number(pendingAllocRes.rows[0].pending_count) === 0 && totalReceived >= Number(po.total_quantity);
        const newPoStatus = isFullyDone ? 'COMPLETED' : 'PARTIALLY_RECEIVED';

        await db.query(`
          UPDATE purchase_orders
          SET received_quantity = $1,
              status = $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [totalReceived, newPoStatus, po_id]);
      }
    }

    // Ghi lifecycle
    await db.query(`
      INSERT INTO lifecycle_events (
        id, entity_type, entity_id, event_type, old_status, new_status, actor_id, actor_name, event_at, note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      crypto.randomUUID(), 'RECEIPT', recId, receiptStatus === 'DISCREPANCY' ? 'RECEIPT_DISCREPANCY' : 'RECEIPT_CONFIRMED',
      null, receiptStatus, currentUser.id, currentUser.full_name,
      now, `Đơn vị xác nhận ${receiptStatus === 'DISCREPANCY' ? 'nhận hàng có sai lệch/hư hỏng' : 'nhận hàng thành công'} (${totalQtyReceivedInBatch} sp)`
    ]);

    return await queryOne(`SELECT * FROM receipt_confirmations WHERE id = $1`, [recId]);
  });
}

export async function getReceiptConfirmationDetail(receiptId) {
  const rec = await queryOne(`
    SELECT rc.*, d.name as department_name, d.code as department_code,
           po.po_number, pod.delivery_code
    FROM receipt_confirmations rc
    JOIN departments d ON d.id = rc.department_id
    LEFT JOIN purchase_orders po ON po.id = rc.po_id
    LEFT JOIN purchase_order_deliveries pod ON pod.id = rc.delivery_id
    WHERE rc.id = $1
  `, [receiptId]);

  if (!rec) return null;

  const items = await query(`
    SELECT rci.*, poi.item_name, poi.spec, poi.unit_price,
           pia.allocated_quantity
    FROM receipt_confirmation_items rci
    LEFT JOIN purchase_order_items poi ON poi.id = rci.po_item_id
    LEFT JOIN po_item_allocations pia ON pia.id = rci.allocation_id
    WHERE rci.receipt_id = $1
  `, [receiptId]);

  rec.items = items;
  return rec;
}
