import crypto from 'crypto';
import { query, queryOne } from '../config/database.js';
import { logAudit } from '../middlewares/errorHandler.js';

/**
 * Nhà cung cấp xác nhận nhận đơn hàng
 */
export async function confirmVendorOrder(poId, notes = '', currentUser = null) {
  const po = await queryOne('SELECT * FROM purchase_orders WHERE id = $1', [poId]);
  if (!po) throw new Error('Không tìm thấy hồ sơ PO.');

  const actorName = currentUser ? currentUser.full_name : 'Đối tác Nhà cung cấp';
  const actorRole = currentUser ? currentUser.role : 'SUPPLIER';

  // 1. Cập nhật trạng thái PO
  await query(
    `UPDATE purchase_orders 
     SET po_status = 'DOI_TAC_XAC_NHAN', updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [poId]
  );

  // 2. Cập nhật vòng đời
  await query(
    `UPDATE procurement_lifecycles 
     SET vendor_confirmed_at = CURRENT_TIMESTAMP, current_stage = 'DOI_TAC_XAC_NHAN', updated_at = CURRENT_TIMESTAMP 
     WHERE po_id = $1`,
    [poId]
  );

  // 3. Ghi sự kiện
  const evId = `ev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await query(
    `INSERT INTO lifecycle_events (id, po_id, object_type, object_id, previous_status, new_status, actor_id, actor_name, actor_role, event_time, note)
     VALUES ($1, $2, 'PURCHASE_ORDER', $2, $3, 'DOI_TAC_XAC_NHAN', $4, $5, $6, CURRENT_TIMESTAMP, $7)`,
    [
      evId,
      poId,
      po.po_status,
      currentUser?.id || null,
      actorName,
      actorRole,
      notes || 'Nhà cung cấp đã tiếp nhận và xác nhận thực hiện đơn hàng PO.'
    ]
  );

  // 4. Tạo thông báo cho QTTS
  const notifId = `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await query(
    `INSERT INTO notifications (id, target_role, title, message, link, created_at)
     VALUES ($1, 'QTTS', $2, $3, $4, CURRENT_TIMESTAMP)`,
    [
      notifId,
      `Đối tác xác nhận PO ${po.po_number}`,
      `Nhà cung cấp ${actorName} đã xác nhận tiếp nhận thực hiện đơn hàng ${po.po_number}.`,
      `/pos/${po.id}`
    ]
  );

  return { success: true, message: 'Đã xác nhận đơn hàng thành công.' };
}

/**
 * Nhà cung cấp cập nhật ngày dự kiến giao hàng (lưu lịch sử người thay đổi)
 */
export async function updateExpectedDeliveryDate(poId, expectedDate, reason = '', currentUser = null) {
  const po = await queryOne('SELECT * FROM purchase_orders WHERE id = $1', [poId]);
  if (!po) throw new Error('Không tìm thấy hồ sơ PO.');

  const dateObj = new Date(expectedDate);
  if (isNaN(dateObj.getTime())) {
    throw new Error('Ngày dự kiến giao hàng không hợp lệ.');
  }

  const actorName = currentUser ? currentUser.full_name : 'Đối tác Nhà cung cấp';
  const actorId = currentUser ? currentUser.id : null;

  // Lấy hoặc tạo đợt giao hàng mặc định cho PO
  let delivery = await queryOne(
    `SELECT id, expected_delivery_date FROM purchase_order_deliveries WHERE po_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [poId]
  );

  if (!delivery) {
    const delId = `del_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const delCode = `DEL-${po.po_number}-01`;
    await query(
      `INSERT INTO purchase_order_deliveries (id, po_id, delivery_code, expected_delivery_date, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'CHUA_GIAO', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [delId, poId, delCode, dateObj, actorName]
    );
    delivery = { id: delId };
  } else {
    await query(
      `UPDATE purchase_order_deliveries 
       SET expected_delivery_date = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [dateObj, delivery.id]
    );
  }

  // Lưu bản ghi lịch sử thay đổi ngày hẹn giao (Bắt buộc theo yêu cầu)
  const changeId = `ed_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await query(
    `INSERT INTO expected_delivery_dates (id, po_id, delivery_id, proposed_date, reason, changed_by_user_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
    [
      changeId,
      poId,
      delivery.id,
      dateObj,
      reason || 'Nhà cung cấp cập nhật lịch giao hàng dự kiến',
      actorId
    ]
  );

  // Ghi nhật ký sự kiện
  const evId = `ev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await query(
    `INSERT INTO lifecycle_events (id, po_id, object_type, object_id, previous_status, new_status, actor_id, actor_name, actor_role, event_time, note)
     VALUES ($1, $2, 'DELIVERY_SCHEDULE', $2, NULL, 'HEN_LICH_GIAO', $3, $4, $5, CURRENT_TIMESTAMP, $6)`,
    [
      evId,
      poId,
      actorId,
      actorName,
      currentUser?.role || 'SUPPLIER',
      `Cập nhật ngày dự kiến giao: ${dateObj.toLocaleDateString('vi-VN')}. Lý do: ${reason || 'Không có ghi chú'}`
    ]
  );

  // Cảnh báo nếu ngày hẹn giao vượt quá SLA
  const lc = await queryOne('SELECT exported_at, sla_target_hours FROM procurement_lifecycles WHERE po_id = $1', [poId]);
  if (lc && lc.exported_at) {
    const maxTarget = new Date(new Date(lc.exported_at).getTime() + (lc.sla_target_hours || 120) * 3600 * 1000);
    if (dateObj > maxTarget) {
      await query('UPDATE procurement_lifecycles SET is_overdue = true WHERE po_id = $1', [poId]);
    }
  }

  return { success: true, message: 'Đã cập nhật ngày hẹn giao thành công và lưu lịch sử.' };
}

/**
 * Nhà cung cấp tạo đợt xuất giao hàng (Dispatch Delivery)
 */
export async function dispatchVendorDelivery(poId, deliveryData, currentUser = null) {
  const {
    delivery_code,
    actual_date,
    notes,
    items = [] // mảng { po_item_id, delivery_qty }
  } = deliveryData;

  const po = await queryOne('SELECT * FROM purchase_orders WHERE id = $1', [poId]);
  if (!po) throw new Error('Không tìm thấy hồ sơ PO.');

  const actorName = currentUser ? currentUser.full_name : 'Đối tác Nhà cung cấp';
  const actorRole = currentUser ? currentUser.role : 'SUPPLIER';

  const delId = `del_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const finalCode = delivery_code || `DEL-${po.po_number}-${Date.now().toString().slice(-4)}`;
  const actualDateObj = actual_date ? new Date(actual_date) : new Date();

  // 1. Tạo đợt giao hàng
  await query(
    `INSERT INTO purchase_order_deliveries (id, po_id, delivery_code, supplier_id, actual_delivery_date, status, notes, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'DA_GIAO', $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      delId,
      poId,
      finalCode,
      currentUser?.supplier_id || null,
      actualDateObj,
      notes || 'Đối tác xác nhận đã xuất kho và giao hàng đến địa chỉ thụ hưởng.',
      actorName
    ]
  );

  // 2. Chi tiết số lượng giao cho từng món
  for (const item of items) {
    const diId = `di_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await query(
      `INSERT INTO delivery_items (id, delivery_id, po_item_id, delivery_qty, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [diId, delId, item.po_item_id, Number(item.delivery_qty) || 0]
    );
  }

  // 3. Cập nhật trạng thái PO sang DOI_TAC_DA_GIAO
  await query(
    `UPDATE purchase_orders 
     SET delivery_status = 'DOI_TAC_DA_GIAO', updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [poId]
  );

  // 4. Cập nhật vòng đời
  await query(
    `UPDATE procurement_lifecycles 
     SET shipped_at = CURRENT_TIMESTAMP, delivered_at = $1, current_stage = 'DOI_TAC_DA_GIAO', updated_at = CURRENT_TIMESTAMP 
     WHERE po_id = $2`,
    [actualDateObj, poId]
  );

  // 5. Ghi sự kiện vòng đời
  const evId = `ev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await query(
    `INSERT INTO lifecycle_events (id, po_id, object_type, object_id, previous_status, new_status, actor_id, actor_name, actor_role, event_time, note)
     VALUES ($1, $2, 'DELIVERY', $3, 'DANG_GIAO', 'DOI_TAC_DA_GIAO', $4, $5, $6, CURRENT_TIMESTAMP, $7)`,
    [
      evId,
      poId,
      delId,
      currentUser?.id || null,
      actorName,
      actorRole,
      `Đối tác xác nhận giao đợt ${finalCode}. Ngày giao thực tế: ${actualDateObj.toLocaleDateString('vi-VN')}.`
    ]
  );

  // 6. Gửi thông báo đến đơn vị thụ hưởng để chuẩn bị xác nhận nhận hàng
  const notifId = `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await query(
    `INSERT INTO notifications (id, target_role, title, message, link, created_at)
     VALUES ($1, 'UNIT_USER', $2, $3, $4, CURRENT_TIMESTAMP)`,
    [
      notifId,
      `Đơn vị cần xác nhận nhận hàng PO ${po.po_number}`,
      `Nhà cung cấp đã giao đợt hàng ${finalCode} cho hồ sơ ${po.po_number}. Vui lòng kiểm tra thực tế và xác nhận biên bản.`,
      `/receipts/${po.id}`
    ]
  );

  return { success: true, delivery_id: delId, delivery_code: finalCode };
}
