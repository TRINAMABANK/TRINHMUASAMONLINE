import crypto from 'crypto';
import { query, queryOne } from '../config/database.js';
import { logAudit } from '../middlewares/errorHandler.js';

/**
 * Lấy danh sách PO với bộ lọc đa tiêu chí và phân quyền (RBAC)
 */
export async function getPurchaseOrdersList(filters = {}, currentUser = null) {
  let whereClauses = [];
  let params = [];
  let pIdx = 1;

  // 1. Phân quyền dữ liệu theo vai trò
  if (currentUser) {
    if (currentUser.role === 'UNIT_USER') {
      // Nhân viên Chi nhánh / PGD / OneBank chỉ nhìn thấy dữ liệu thuộc đơn vị của mình
      const dept = await queryOne('SELECT name, code FROM departments WHERE id = $1', [currentUser.department_id]);
      if (dept) {
        whereClauses.push(`EXISTS (
          SELECT 1 FROM purchase_order_items poi 
          WHERE poi.po_id = po.id 
          AND (LOWER(poi.unit_name) LIKE LOWER($${pIdx}) OR LOWER(poi.unit_name) LIKE LOWER($${pIdx + 1}))
        )`);
        params.push(`%${dept.name}%`, `%${dept.code}%`);
        pIdx += 2;
      }
    } else if (currentUser.role === 'SUPPLIER') {
      // Nhà cung cấp chỉ được xem các PO được phân công
      whereClauses.push(`(
        EXISTS (
          SELECT 1 FROM supplier_po_assignments spa 
          WHERE spa.po_id = po.id AND spa.supplier_id = $${pIdx}
        ) OR EXISTS (
          SELECT 1 FROM purchase_order_items poi
          JOIN suppliers s ON LOWER(poi.supplier_name) = LOWER(s.name)
          WHERE poi.po_id = po.id AND s.id = $${pIdx}
        )
      )`);
      params.push(currentUser.supplier_id);
      pIdx++;
    }
  }

  // 2. Bộ lọc theo mã PO
  if (filters.po_number) {
    whereClauses.push(`po.po_number ILIKE $${pIdx}`);
    params.push(`%${filters.po_number}%`);
    pIdx++;
  }

  // 3. Bộ lọc theo tên hàng hóa
  if (filters.item_name) {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM purchase_order_items poi 
      WHERE poi.po_id = po.id AND poi.item_name ILIKE $${pIdx}
    )`);
    params.push(`%${filters.item_name}%`);
    pIdx++;
  }

  // 4. Bộ lọc theo đơn vị (Chi nhánh, PGD, OneBank)
  if (filters.unit_name) {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM purchase_order_items poi 
      WHERE poi.po_id = po.id AND poi.unit_name ILIKE $${pIdx}
    )`);
    params.push(`%${filters.unit_name}%`);
    pIdx++;
  }

  // 5. Bộ lọc theo nhà cung cấp
  if (filters.supplier_name) {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM purchase_order_items poi 
      WHERE poi.po_id = po.id AND poi.supplier_name ILIKE $${pIdx}
    )`);
    params.push(`%${filters.supplier_name}%`);
    pIdx++;
  }

  // 6. Bộ lọc theo trạng thái (submission_status, po_status, delivery_status)
  if (filters.submission_status) {
    whereClauses.push(`po.submission_status = $${pIdx}`);
    params.push(filters.submission_status);
    pIdx++;
  }
  if (filters.po_status) {
    whereClauses.push(`po.po_status = $${pIdx}`);
    params.push(filters.po_status);
    pIdx++;
  }
  if (filters.delivery_status) {
    whereClauses.push(`po.delivery_status = $${pIdx}`);
    params.push(filters.delivery_status);
    pIdx++;
  }

  // 7. Bộ lọc thời gian
  if (filters.from_date) {
    whereClauses.push(`po.order_date >= $${pIdx}`);
    params.push(filters.from_date);
    pIdx++;
  }
  if (filters.to_date) {
    whereClauses.push(`po.order_date <= $${pIdx}`);
    params.push(filters.to_date);
    pIdx++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT po.*,
           lc.current_stage, lc.is_overdue, lc.sla_target_hours,
           lc.exported_at, lc.approved_at, lc.ordered_at, lc.vendor_confirmed_at,
           lc.shipped_at, lc.delivered_at, lc.received_at, lc.completed_at
    FROM purchase_orders po
    LEFT JOIN procurement_lifecycles lc ON po.id = lc.po_id
    ${whereSql}
    ORDER BY po.created_at DESC
  `;

  const pos = await query(sql, params);

  // Lấy chi tiết các dòng hàng hóa cho từng PO
  for (const p of pos) {
    p.items = await query(
      `SELECT * FROM purchase_order_items WHERE po_id = $1 ORDER BY stt ASC`,
      [p.id]
    );
  }

  return pos;
}

/**
 * Lấy chi tiết toàn diện của 1 PO (bao gồm Items, Deliveries, Receipts, Timeline Events)
 */
export async function getPurchaseOrderDetail(poId, currentUser = null) {
  const po = await queryOne(
    `SELECT po.*,
            lc.current_stage, lc.is_overdue, lc.sla_target_hours,
            lc.exported_at, lc.approved_at, lc.ordered_at, lc.vendor_confirmed_at,
            lc.shipped_at, lc.delivered_at, lc.received_at, lc.completed_at
     FROM purchase_orders po
     LEFT JOIN procurement_lifecycles lc ON po.id = lc.po_id
     WHERE po.id = $1 OR po.po_number = $1`,
    [poId]
  );

  if (!po) return null;

  // 1. Dòng hàng hóa
  po.items = await query(
    `SELECT * FROM purchase_order_items WHERE po_id = $1 ORDER BY stt ASC`,
    [po.id]
  );

  // 2. Các đợt giao hàng
  po.deliveries = await query(
    `SELECT pod.*, s.name as supplier_name
     FROM purchase_order_deliveries pod
     LEFT JOIN suppliers s ON pod.supplier_id = s.id
     WHERE pod.po_id = $1 ORDER BY pod.created_at ASC`,
    [po.id]
  );

  for (const del of po.deliveries) {
    del.items = await query(
      `SELECT di.*, poi.item_name, poi.unit_name, poi.spec
       FROM delivery_items di
       JOIN purchase_order_items poi ON di.po_item_id = poi.id
       WHERE di.delivery_id = $1`,
      [del.id]
    );
  }

  // 3. Các biên bản nhận hàng
  po.receipts = await query(
    `SELECT rc.*, d.name as department_name, u.full_name as receiver_full_name
     FROM receipt_confirmations rc
     LEFT JOIN departments d ON rc.department_id = d.id
     LEFT JOIN users u ON rc.received_by_user_id = u.id
     WHERE rc.po_id = $1 ORDER BY rc.created_at ASC`,
    [po.id]
  );

  for (const rec of po.receipts) {
    rec.items = await query(
      `SELECT ri.*, poi.item_name, poi.unit_name, poi.spec
       FROM receipt_items ri
       JOIN purchase_order_items poi ON ri.po_item_id = poi.id
       WHERE ri.receipt_id = $1`,
      [rec.id]
    );
  }

  // 4. Lịch sử đợt thanh toán (ACCEPT)
  po.payment_batches = await query(
    `SELECT * FROM payment_batches WHERE po_id = $1 ORDER BY created_at ASC`,
    [po.id]
  );

  // 5. Nhật ký sự kiện vòng đời (Timeline Events)
  po.events = await query(
    `SELECT * FROM lifecycle_events WHERE po_id = $1 ORDER BY event_time ASC`,
    [po.id]
  );

  // 6. Lịch sử phê duyệt
  po.approvals = await query(
    `SELECT * FROM approval_histories WHERE po_id = $1 ORDER BY created_at ASC`,
    [po.id]
  );

  return po;
}

/**
 * Tạo mới hồ sơ PO từ dữ liệu nhập Excel hoặc form
 */
export async function createPurchaseOrderRecord(poData, currentUser = null) {
  const {
    po_number,
    date,
    requester,
    note,
    source,
    items = []
  } = poData;

  if (!po_number) {
    throw new Error('Số hiệu PO không được để trống.');
  }

  // 1. Chống nhập trùng: Kiểm tra mã PO đã tồn tại chưa
  const existing = await queryOne('SELECT id FROM purchase_orders WHERE po_number = $1', [po_number]);
  if (existing) {
    throw new Error(`Mã hồ sơ ${po_number} đã tồn tại trên hệ thống. Vui lòng kiểm tra lại.`);
  }

  const poId = `po_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const totalQty = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  const totalAmount = items.reduce((sum, it) => sum + (Number(it.amount) || (Number(it.qty || 1) * Number(it.price || 0))), 0);

  const actorName = currentUser ? currentUser.full_name : requester || 'Cán bộ QTTS';
  const actorRole = currentUser ? currentUser.role : 'QTTS';
  const actorId = currentUser ? currentUser.id : null;

  // Tạo Purchase Order
  await query(
    `INSERT INTO purchase_orders (id, po_number, order_date, requester_name, note, source_file, submission_status, po_status, delivery_status, total_amount, total_qty, created_by_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'KHOI_TAO', 'DA_TAO_PO', 'CHUA_GIAO', $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      poId,
      po_number,
      date ? new Date(date) : new Date(),
      requester || actorName,
      note || '',
      source || 'File Excel nhập khẩu',
      totalAmount,
      totalQty,
      actorId
    ]
  );

  // Tạo các dòng items
  let stt = 1;
  for (const item of items) {
    const itemId = `item_${Date.now()}_${stt}_${crypto.randomBytes(3).toString('hex')}`;
    const qtyNum = Number(item.qty) || 1;
    const priceNum = Number(item.price) || 0;
    const amtNum = Number(item.amount) || (qtyNum * priceNum);

    await query(
      `INSERT INTO purchase_order_items (id, po_id, stt, request_date, unit_name, supplier_name, item_name, qty, spec, unit_price, amount, purpose, msp, pay_group, received_qty, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        itemId,
        poId,
        stt++,
        item.date || null,
        item.unit || '',
        item.supplier || '',
        item.item || '',
        qtyNum,
        item.spec || 'CÁI',
        priceNum,
        amtNum,
        item.purpose || '',
        item.msp || '',
        item.payGroup || null
      ]
    );
  }

  // Khởi tạo vòng đời mua sắm (Giai đoạn 1: PHIẾU TRÌNH ĐƯỢC XUẤT)
  const lcId = `lc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await query(
    `INSERT INTO procurement_lifecycles (id, po_id, current_stage, exported_at, created_at, updated_at)
     VALUES ($1, $2, 'PHIEU_TRINH_XUAT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [lcId, poId]
  );

  // Ghi nhật ký sự kiện vòng đời
  const evId = `ev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await query(
    `INSERT INTO lifecycle_events (id, po_id, object_type, object_id, previous_status, new_status, actor_id, actor_name, actor_role, event_time, note)
     VALUES ($1, $2, 'PURCHASE_ORDER', $2, NULL, 'PHIEU_TRINH_XUAT', $3, $4, $5, CURRENT_TIMESTAMP, $6)`,
    [
      evId,
      poId,
      actorId,
      actorName,
      actorRole,
      `Khởi tạo hồ sơ mua sắm ${po_number} với ${items.length} mặt hàng từ ${source || 'Excel'}`
    ]
  );

  // Nếu có phân loại nhóm, lưu PaymentBatch
  const hoItems = items.filter(x => x.payGroup === 'HOI_SO' || x.payGroup === 'A');
  const dvItems = items.filter(x => x.payGroup === 'DON_VI' || x.payGroup === 'B');

  if (hoItems.length > 0) {
    const batchId = `batch_ho_${Date.now()}`;
    const hoAmt = hoItems.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    await query(
      `INSERT INTO payment_batches (id, batch_code, po_id, pay_type, item_count, total_amount, accepted_by, created_at)
       VALUES ($1, $2, $3, 'HOI_SO', $4, $5, $6, CURRENT_TIMESTAMP)`,
      [batchId, `${po_number}-HO`, poId, hoItems.length, hoAmt, actorName]
    );
  }

  if (dvItems.length > 0) {
    const batchId = `batch_dv_${Date.now()}`;
    const dvAmt = dvItems.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    await query(
      `INSERT INTO payment_batches (id, batch_code, po_id, pay_type, item_count, total_amount, accepted_by, created_at)
       VALUES ($1, $2, $3, 'DON_VI', $4, $5, $6, CURRENT_TIMESTAMP)`,
      [batchId, `${po_number}-DV`, poId, dvItems.length, dvAmt, actorName]
    );
  }

  await logAudit(actorId, actorName, actorRole, 'CREATE', 'PURCHASE_ORDER', poId, null, { po_number, totalAmount, totalQty });

  return await getPurchaseOrderDetail(poId);
}

/**
 * Xử lý ACCEPT phân loại thanh toán hàng loạt
 */
export async function acceptClassificationBatch(poId, chosenType, selectedItemIds = [], currentUser = null) {
  const po = await queryOne('SELECT * FROM purchase_orders WHERE id = $1', [poId]);
  if (!po) throw new Error('Không tìm thấy hồ sơ PO.');

  const otherType = chosenType === 'HOI_SO' ? 'DON_VI' : 'HOI_SO';
  const actorName = currentUser ? currentUser.full_name : 'Cán bộ QTTS';

  // Cập nhật các dòng được chọn
  if (selectedItemIds.length > 0) {
    for (const id of selectedItemIds) {
      await query('UPDATE purchase_order_items SET pay_group = $1 WHERE id = $2 AND po_id = $3', [chosenType, id, poId]);
    }
    // Các dòng còn lại tự động thuộc nhóm kia
    await query(
      `UPDATE purchase_order_items SET pay_group = $1 WHERE po_id = $2 AND id NOT IN (${selectedItemIds.map((_, i) => `$${i + 3}`).join(',')})`,
      [otherType, poId, ...selectedItemIds]
    );
  } else {
    // Nếu không truyền ID cụ thể, áp dụng cho toàn bộ dòng chưa gán
    await query('UPDATE purchase_order_items SET pay_group = $1 WHERE po_id = $2', [chosenType, poId]);
  }

  // Ghi nhật ký sự kiện
  const evId = `ev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await query(
    `INSERT INTO lifecycle_events (id, po_id, object_type, object_id, previous_status, new_status, actor_id, actor_name, actor_role, event_time, note)
     VALUES ($1, $2, 'PAYMENT_BATCH', $2, 'PHAN_LOAI_TT', 'ACCEPT', $3, $4, $5, CURRENT_TIMESTAMP, $6)`,
    [
      evId,
      poId,
      currentUser?.id || null,
      actorName,
      currentUser?.role || 'QTTS',
      `ACCEPT xác nhận phân loại thanh toán: ${chosenType} cho các dòng được chọn và ${otherType} cho phần còn lại.`
    ]
  );

  return await getPurchaseOrderDetail(poId);
}
