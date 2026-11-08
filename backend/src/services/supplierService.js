import crypto from 'crypto';
import { query, queryOne, transaction } from '../config/database.js';

export async function getSupplierPurchaseOrders(currentUser) {
  let whereClauses = ['po.deleted_at IS NULL'];
  let params = [];

  if (currentUser.roles.includes('SUPPLIER')) {
    if (!currentUser.supplier_id) {
      throw new Error('Tài khoản nhà cung cấp chưa được liên kết với nhà cung cấp nào.');
    }
    whereClauses.push(`po.supplier_id = $1`);
    params.push(currentUser.supplier_id);
  }

  const sql = `
    SELECT po.*,
           s.name as supplier_name, s.code as supplier_code,
           pr.request_number, pr.title as request_title,
           (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.po_id = po.id) as item_count,
           (SELECT COUNT(*) FROM purchase_order_deliveries pod WHERE pod.po_id = po.id) as delivery_batch_count,
           COALESCE((SELECT SUM(quantity_delivered) FROM delivery_items di JOIN purchase_order_deliveries pod ON pod.id = di.delivery_id WHERE pod.po_id = po.id), 0) as delivered_quantity,
           COALESCE((SELECT SUM(quantity_received) FROM receipt_confirmation_items rci JOIN receipt_confirmations rc ON rc.id = rci.receipt_id WHERE rc.po_id = po.id), 0) as received_quantity
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplier_id
    LEFT JOIN procurement_requests pr ON pr.id = po.request_id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY po.order_date DESC
  `;

  return await query(sql, params);
}

export async function confirmSupplierPo(poId, expectedDate, currentUser, note = '') {
  return await transaction(async (db) => {
    const po = await queryOne(`SELECT * FROM purchase_orders WHERE id = $1`, [poId]);
    if (!po) throw new Error('Không tìm thấy Purchase Order.');

    if (currentUser.roles.includes('SUPPLIER') && currentUser.supplier_id !== po.supplier_id) {
      const err = new Error('Truy cập bị từ chối: Bạn không có quyền xác nhận PO của nhà cung cấp khác.');
      err.statusCode = 403;
      throw err;
    }

    const expDate = expectedDate ? new Date(expectedDate) : null;
    const now = new Date();

    await db.query(`
      UPDATE purchase_orders
      SET status = 'SUPPLIER_CONFIRMED',
          expected_delivery_date = $1,
          updated_at = $2
      WHERE id = $3
    `, [expDate, now, poId]);

    // Ghi lifecycle event
    await db.query(`
      INSERT INTO lifecycle_events (
        id, entity_type, entity_id, event_type, old_status, new_status, actor_id, actor_name, event_at, note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      crypto.randomUUID(), 'PURCHASE_ORDER', poId, 'SUPPLIER_CONFIRMED',
      po.status, 'SUPPLIER_CONFIRMED', currentUser.id, currentUser.full_name,
      now, note || `Nhà cung cấp xác nhận đơn hàng. Ngày dự kiến giao: ${expectedDate || 'Chưa ấn định'}`
    ]);

    return await queryOne(`SELECT * FROM purchase_orders WHERE id = $1`, [poId]);
  });
}

export async function createSupplierDelivery(deliveryData, currentUser) {
  return await transaction(async (db) => {
    const { po_id, carrier, tracking_number, note, delivery_date, items = [] } = deliveryData;
    if (!po_id) throw new Error('Thiếu po_id của đơn đặt hàng.');

    const po = await queryOne(`SELECT * FROM purchase_orders WHERE id = $1`, [po_id]);
    if (!po) throw new Error('Không tìm thấy Purchase Order.');

    if (currentUser.roles.includes('SUPPLIER') && currentUser.supplier_id !== po.supplier_id) {
      const err = new Error('Truy cập bị từ chối: Bạn không thể tạo đợt giao hàng cho PO của nhà cung cấp khác.');
      err.statusCode = 403;
      throw err;
    }

    const delivId = crypto.randomUUID();
    const delivCode = `DEL-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    const dDate = delivery_date ? new Date(delivery_date) : new Date();

    await db.query(`
      INSERT INTO purchase_order_deliveries (
        id, po_id, delivery_code, supplier_id, delivery_date, status, carrier, tracking_number, note, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      delivId, po_id, delivCode, po.supplier_id, dDate,
      'DISPATCHED', carrier || null, tracking_number || null, note || null, currentUser.id
    ]);

    let totalQtyDeliveredInBatch = 0;

    for (const it of items) {
      const qtyDelivered = Number(it.quantity_delivered || 0);
      if (qtyDelivered <= 0) continue;

      totalQtyDeliveredInBatch += qtyDelivered;

      await db.query(`
        INSERT INTO delivery_items (id, delivery_id, po_item_id, allocation_id, quantity_delivered, note)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [crypto.randomUUID(), delivId, it.po_item_id || null, it.allocation_id || null, qtyDelivered, it.note || null]);

      // Cập nhật po_item_allocations
      if (it.allocation_id) {
        await db.query(`
          UPDATE po_item_allocations
          SET delivered_quantity = delivered_quantity + $1,
              status = CASE 
                WHEN delivered_quantity + $1 >= allocated_quantity THEN 'DELIVERED'
                ELSE 'PARTIALLY_DELIVERED'
              END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [qtyDelivered, it.allocation_id]);
      }

      // Cập nhật purchase_order_items
      if (it.po_item_id) {
        await db.query(`
          UPDATE purchase_order_items
          SET delivered_quantity = delivered_quantity + $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [qtyDelivered, it.po_item_id]);
      }
    }

    // Cập nhật tổng số lượng giao của PO và cập nhật status PO
    const sumRes = await db.query(`
      SELECT COALESCE(SUM(quantity_delivered), 0) as total_delivered
      FROM delivery_items di
      JOIN purchase_order_deliveries pod ON pod.id = di.delivery_id
      WHERE pod.po_id = $1
    `, [po_id]);

    const totalDelivered = Number(sumRes.rows[0].total_delivered || 0);
    const newPoStatus = totalDelivered >= Number(po.total_quantity) ? 'DELIVERED' : 'PARTIALLY_DELIVERED';

    await db.query(`
      UPDATE purchase_orders
      SET delivered_quantity = $1,
          status = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [totalDelivered, newPoStatus, po_id]);

    // Ghi lifecycle
    await db.query(`
      INSERT INTO lifecycle_events (
        id, entity_type, entity_id, event_type, old_status, new_status, actor_id, actor_name, event_at, note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      crypto.randomUUID(), 'DELIVERY', delivId, 'DELIVERY_DISPATCHED',
      null, 'DISPATCHED', currentUser.id, currentUser.full_name,
      dDate, `Xuất kho đợt giao ${delivCode} với ${totalQtyDeliveredInBatch} sản phẩm`
    ]);

    return await queryOne(`SELECT * FROM purchase_order_deliveries WHERE id = $1`, [delivId]);
  });
}
