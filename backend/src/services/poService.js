import crypto from 'crypto';
import { query, queryOne } from '../config/database.js';
import { logAudit } from '../middlewares/errorHandler.js';
import { calculatePOTimings } from '../utils/timingUtils.js';

/**
 * Lấy danh sách PO với bộ lọc đa tiêu chí, tính toán timing và phân quyền (RBAC)
 */
export async function getPurchaseOrdersList(filters = {}, currentUser = null) {
  let whereClauses = [];
  let params = [];
  let pIdx = 1;

  // 1. Phân quyền dữ liệu theo vai trò
  if (currentUser) {
    if (currentUser.role === 'UNIT_USER' || currentUser.roles?.includes('DON_VI')) {
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
          SELECT 1 FROM purchase_order_items poi
          JOIN suppliers s ON LOWER(poi.supplier_name) = LOWER(s.name) OR poi.supplier_id = s.id
          WHERE poi.po_id = po.id AND s.id = $${pIdx}
        ) OR po.supplier_id = $${pIdx}
      )`);
      params.push(currentUser.supplier_id);
      pIdx++;
    }
  }

  // 2. Tìm kiếm tổng quát theo từ khóa (q)
  if (filters.q) {
    const qTerm = `%${filters.q.trim()}%`;
    whereClauses.push(`(
      po.po_number ILIKE $${pIdx} OR
      po.requester_name ILIKE $${pIdx} OR
      po.representative_unit ILIKE $${pIdx} OR
      po.note ILIKE $${pIdx} OR
      EXISTS (
        SELECT 1 FROM purchase_order_items poi 
        WHERE poi.po_id = po.id AND (
          poi.item_name ILIKE $${pIdx} OR
          poi.unit_name ILIKE $${pIdx} OR
          poi.supplier_name ILIKE $${pIdx} OR
          poi.msp ILIKE $${pIdx}
        )
      )
    )`);
    params.push(qTerm);
    pIdx++;
  }

  // 3. Bộ lọc theo mã PO
  if (filters.po_number) {
    whereClauses.push(`po.po_number ILIKE $${pIdx}`);
    params.push(`%${filters.po_number}%`);
    pIdx++;
  }

  // 4. Bộ lọc theo người đề xuất
  if (filters.requester) {
    whereClauses.push(`po.requester_name ILIKE $${pIdx}`);
    params.push(`%${filters.requester}%`);
    pIdx++;
  }

  // 5. Bộ lọc theo tên hàng hóa
  if (filters.item_name) {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM purchase_order_items poi 
      WHERE poi.po_id = po.id AND poi.item_name ILIKE $${pIdx}
    )`);
    params.push(`%${filters.item_name}%`);
    pIdx++;
  }

  // 6. Bộ lọc theo đơn vị (Chi nhánh, PGD, OneBank)
  if (filters.unit_name) {
    whereClauses.push(`(
      po.representative_unit ILIKE $${pIdx} OR
      EXISTS (
        SELECT 1 FROM purchase_order_items poi 
        WHERE poi.po_id = po.id AND poi.unit_name ILIKE $${pIdx}
      )
    )`);
    params.push(`%${filters.unit_name}%`);
    pIdx++;
  }

  // 7. Bộ lọc theo nhà cung cấp
  if (filters.supplier_name) {
    whereClauses.push(`(
      po.supplier_name ILIKE $${pIdx} OR
      EXISTS (
        SELECT 1 FROM purchase_order_items poi 
        WHERE poi.po_id = po.id AND poi.supplier_name ILIKE $${pIdx}
      )
    )`);
    params.push(`%${filters.supplier_name}%`);
    pIdx++;
  }

  // 8. Bộ lọc theo trạng thái
  if (filters.status) {
    const s = filters.status;
    if (s === 'Chờ trình ký' || s === 'CHO_TRINH_KY') {
      whereClauses.push(`po.submission_status IN ('KHOI_TAO', 'CHO_TRINH_KY')`);
    } else if (s === 'Đang trình ký' || s === 'DANG_TRINH_KY' || s === 'CHO_DUYET') {
      whereClauses.push(`po.submission_status IN ('DANG_TRINH_KY', 'CHO_DUYET')`);
    } else if (s === 'Đã duyệt' || s === 'DA_DUYET') {
      whereClauses.push(`po.submission_status = 'DA_DUYET' AND po.po_status NOT IN ('DA_DAT_HANG', 'HOAN_TAT')`);
    } else if (s === 'Từ chối' || s === 'TU_CHOI') {
      whereClauses.push(`po.submission_status = 'TU_CHOI'`);
    } else if (s === 'Đã đặt hàng' || s === 'DA_DAT_HANG') {
      whereClauses.push(`po.po_status = 'DA_DAT_HANG' AND po.delivery_status NOT IN ('DANG_GIAO', 'HOAN_TAT')`);
    } else if (s === 'Đang giao hàng' || s === 'DANG_GIAO') {
      whereClauses.push(`po.delivery_status = 'DANG_GIAO'`);
    } else if (s === 'Chờ đơn vị xác nhận' || s === 'DA_NHAN_MOT_PHAN' || s === 'CHO_XAC_NHAN') {
      whereClauses.push(`po.delivery_status = 'DA_NHAN_MOT_PHAN'`);
    } else if (s === 'Hoàn tất' || s === 'HOAN_TAT') {
      whereClauses.push(`(po.po_status = 'HOAN_TAT' OR po.delivery_status = 'HOAN_TAT')`);
    }
  }

  // 9. Bộ lọc thời gian (order_date hoặc created_at)
  if (filters.from_date) {
    whereClauses.push(`(po.order_date >= $${pIdx} OR po.created_at >= $${pIdx})`);
    params.push(filters.from_date);
    pIdx++;
  }
  if (filters.to_date) {
    whereClauses.push(`(po.order_date <= $${pIdx} OR po.created_at <= $${pIdx})`);
    params.push(filters.to_date);
    pIdx++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT po.*,
           lc.current_stage, lc.is_overdue, lc.sla_target_hours,
           lc.exported_at, lc.approved_at as lc_approved_at, lc.ordered_at as lc_ordered_at
    FROM purchase_orders po
    LEFT JOIN procurement_lifecycles lc ON po.id = lc.po_id
    ${whereSql}
    ORDER BY po.created_at DESC
  `;

  const pos = await query(sql, params);

  // Lấy chi tiết các dòng hàng hóa và tính toán timing cho từng PO
  for (const p of pos) {
    p.items = await query(
      `SELECT * FROM purchase_order_items WHERE po_id = $1 ORDER BY stt ASC`,
      [p.id]
    );

    // Xác định đơn vị đại diện
    if (!p.representative_unit) {
      p.representative_unit = p.items?.[0]?.unit_name || p.items?.[0]?.unit || '—';
    }

    // Xác định trạng thái tổng quát
    if (p.delivery_status === 'HOAN_TAT' || p.po_status === 'HOAN_TAT') {
      p.status = 'Hoàn tất';
    } else if (p.delivery_status === 'DA_NHAN_MOT_PHAN') {
      p.status = 'Chờ đơn vị xác nhận';
    } else if (p.delivery_status === 'DANG_GIAO') {
      p.status = 'Đang giao hàng';
    } else if (p.po_status === 'DA_DAT_HANG' || p.po_status === 'DOI_TAC_XAC_NHAN') {
      p.status = 'Đã đặt hàng';
    } else if (p.submission_status === 'DA_DUYET') {
      p.status = 'Đã duyệt';
    } else if (p.submission_status === 'TU_CHOI') {
      p.status = 'Từ chối';
    } else if (p.submission_status === 'DANG_TRINH_KY' || p.submission_status === 'CHO_DUYET') {
      p.status = 'Đang trình ký';
    } else {
      p.status = 'Chờ trình ký';
    }

    // Tính toán mốc thời gian chuẩn
    p.timings = calculatePOTimings(p);
    p.approval_duration = p.timings.approvalDurationText;
  }

  return pos;
}

/**
 * Lấy chi tiết toàn diện của 1 PO (bao gồm Items, Deliveries, Receipts, Approvals, Email logs, Timeline Events)
 */
export async function getPurchaseOrderDetail(poId, currentUser = null) {
  const po = await queryOne(
    `SELECT po.*,
            lc.current_stage, lc.is_overdue, lc.sla_target_hours,
            lc.exported_at, lc.approved_at as lc_approved_at, lc.ordered_at as lc_ordered_at
     FROM purchase_orders po
     LEFT JOIN procurement_lifecycles lc ON po.id = lc.po_id
     WHERE po.id = $1 OR po.po_number = $1`,
    [poId]
  );

  if (!po) return null;

  // 1. Dòng hàng hóa chi tiết
  po.items = await query(
    `SELECT * FROM purchase_order_items WHERE po_id = $1 ORDER BY stt ASC`,
    [po.id]
  );

  // Đơn vị đại diện
  if (!po.representative_unit) {
    po.representative_unit = po.items?.[0]?.unit_name || po.items?.[0]?.unit || '—';
  }

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
     LEFT JOIN users u ON rc.receiver_id = u.id
     WHERE rc.po_id = $1 ORDER BY rc.created_at ASC`,
    [po.id]
  );

  for (const rec of po.receipts) {
    rec.items = await query(
      `SELECT ri.*, poi.item_name, poi.unit_name, poi.spec
       FROM receipt_confirmation_items ri
       JOIN purchase_order_items poi ON ri.po_item_id = poi.id
       WHERE ri.receipt_id = $1`,
      [rec.id]
    );
  }

  // 4. Lịch sử phê duyệt từng vòng (Approval Histories)
  po.approvals = await query(
    `SELECT * FROM approval_histories WHERE po_id = $1 ORDER BY round ASC, created_at ASC`,
    [po.id]
  );

  // 5. Danh sách các Nhà cung cấp tham gia trong PO (Distinct Suppliers)
  const supplierMap = {};
  for (const item of (po.items || [])) {
    const sName = item.supplier_name || 'Chưa chỉ định NCC';
    if (!supplierMap[sName]) {
      supplierMap[sName] = {
        name: sName,
        code: item.supplier_id || sName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8),
        itemCount: 0,
        totalAmount: 0,
        items: []
      };
    }
    supplierMap[sName].itemCount += (Number(item.qty) || 1);
    supplierMap[sName].totalAmount += (Number(item.amount) || 0);
    supplierMap[sName].items.push(item);
  }
  po.suppliers = Object.values(supplierMap);

  // 6. Lịch sử Email đã gửi cho NCC
  po.email_logs = await query(
    `SELECT el.*, soi.recipient_email, soi.status as invitation_status, s.name as supplier_name
     FROM supplier_order_email_logs el
     JOIN supplier_order_invitations soi ON el.invitation_id = soi.id
     JOIN suppliers s ON soi.supplier_id = s.id
     WHERE soi.purchase_order_id = $1
     ORDER BY el.draft_created_at DESC`,
    [po.id]
  );

  // 7. Nhật ký sự kiện vòng đời (Lifecycle Events)
  po.events = await query(
    `SELECT * FROM lifecycle_events WHERE po_id = $1 ORDER BY event_time ASC`,
    [po.id]
  );

  // 8. Nhật ký kiểm toán (Audit Logs)
  po.audit_logs = await query(
    `SELECT * FROM audit_logs WHERE entity = 'PURCHASE_ORDER' AND entity_id = $1 ORDER BY created_at ASC`,
    [po.id]
  );

  // 9. Xác định trạng thái tổng quát
  if (po.delivery_status === 'HOAN_TAT' || po.po_status === 'HOAN_TAT') {
    po.status = 'Hoàn tất';
  } else if (po.delivery_status === 'DA_NHAN_MOT_PHAN') {
    po.status = 'Chờ đơn vị xác nhận';
  } else if (po.delivery_status === 'DANG_GIAO') {
    po.status = 'Đang giao hàng';
  } else if (po.po_status === 'DA_DAT_HANG' || po.po_status === 'DOI_TAC_XAC_NHAN') {
    po.status = 'Đã đặt hàng';
  } else if (po.submission_status === 'DA_DUYET') {
    po.status = 'Đã duyệt';
  } else if (po.submission_status === 'TU_CHOI') {
    po.status = 'Từ chối';
  } else if (po.submission_status === 'DANG_TRINH_KY' || po.submission_status === 'CHO_DUYET') {
    po.status = 'Đang trình ký';
  } else {
    po.status = 'Chờ trình ký';
  }

  // 10. Tính toán mốc thời gian chuẩn
  po.timings = calculatePOTimings(po);

  return po;
}

/**
 * Tạo mới hồ sơ PO từ dữ liệu nhập Excel
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
  const representativeUnit = items?.[0]?.unit || items?.[0]?.unit_name || 'Hội sở';

  // Tạo Purchase Order
  await query(
    `INSERT INTO purchase_orders (
      id, po_number, order_date, requester_name, representative_unit, note, source_file,
      submission_status, po_status, delivery_status, total_amount, total_qty,
      created_by_id, current_round, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'KHOI_TAO', 'DA_TAO_PO', 'CHUA_GIAO', $8, $9, $10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      poId,
      po_number,
      date ? new Date(date) : new Date(),
      requester || actorName,
      representativeUnit,
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
      `INSERT INTO purchase_order_items (
        id, po_id, stt, request_date, unit_name, supplier_name, item_name, qty, spec,
        unit_price, amount, purpose, msp, pay_group, delivered_qty, received_qty,
        delivery_status, receipt_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, 0, 'CHUA_GIAO', 'CHUA_NHAN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
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

  // Khởi tạo vòng đời mua sắm
  const lcId = `lc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await query(
    `INSERT INTO procurement_lifecycles (id, po_id, current_stage, exported_at, created_at, updated_at)
     VALUES ($1, $2, 'PHIEU_TRINH_XUAT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [lcId, poId]
  );

  // Ghi nhật ký sự kiện vòng đời
  const evId = `ev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await query(
    `INSERT INTO lifecycle_events (id, entity_type, entity_id, event_type, po_id, object_type, object_id, previous_status, new_status, actor_id, actor_name, actor_role, event_time, note)
     VALUES ($1, 'PURCHASE_ORDER', $2, 'KHOI_TAO', $2, 'PURCHASE_ORDER', $2, NULL, 'KHOI_TAO', $3, $4, $5, CURRENT_TIMESTAMP, $6)`,
    [
      evId,
      poId,
      actorId,
      actorName,
      actorRole,
      `Khởi tạo hồ sơ mua sắm ${po_number} với ${items.length} mặt hàng từ ${source || 'Excel'}`
    ]
  );

  await logAudit(actorId, actorName, actorRole, 'CREATE', 'PURCHASE_ORDER', poId, null, { po_number, totalAmount, totalQty });

  return await getPurchaseOrderDetail(poId);
}

/**
 * Gửi trình ký hồ sơ mua sắm (Ghi nhận mốc submitted_at, tạo bản ghi vòng duyệt)
 */
export async function submitPOForApproval(poId, currentUser = null) {
  const po = await getPurchaseOrderDetail(poId);
  if (!po) throw new Error('Không tìm thấy hồ sơ PO.');

  const now = new Date();
  const currentRound = (po.current_round || 1);
  const actorId = currentUser?.id || null;
  const actorName = currentUser?.full_name || po.requester_name || 'Cán bộ QTTS';
  const actorRole = currentUser?.role || 'QTTS';

  await query(
    `UPDATE purchase_orders 
     SET submission_status = 'DANG_TRINH_KY',
         submitted_at = $1,
         approval_started_at = $1,
         rejected_at = NULL,
         updated_at = $1
     WHERE id = $2`,
    [now, po.id]
  );

  // Ghi nhận vòng xử lý vào approval_histories (không ghi đè lịch sử cũ)
  await query(
    `INSERT INTO approval_histories (id, po_id, round, stage, action, actor_id, actor_name, actor_role, comment, submitted_at, created_at)
     VALUES ($1, $2, $3, 'TRINH_KY', 'SUBMIT', $4, $5, $6, $7, $8, $8)`,
    [crypto.randomUUID(), po.id, currentRound, actorId, actorName, actorRole, 'Gửi trình ký hồ sơ mua sắm', now]
  );

  // Ghi lifecycle event
  await query(
    `INSERT INTO lifecycle_events (id, entity_type, entity_id, event_type, po_id, object_type, object_id, previous_status, new_status, actor_id, actor_name, actor_role, event_time, note)
     VALUES ($1, 'PURCHASE_ORDER', $2, 'SUBMIT', $2, 'PURCHASE_ORDER', $2, $3, 'DANG_TRINH_KY', $4, $5, $6, $7, $8)`,
    [crypto.randomUUID(), po.id, po.submission_status, actorId, actorName, actorRole, now, `Gửi trình ký hồ sơ (Vòng ${currentRound})`]
  );

  await logAudit(actorId, actorName, actorRole, 'SUBMIT_APPROVAL', 'PURCHASE_ORDER', po.id, { submission_status: po.submission_status }, { submission_status: 'DANG_TRINH_KY', round: currentRound });

  return await getPurchaseOrderDetail(po.id);
}

/**
 * Phê duyệt hồ sơ mua sắm (Ghi nhận approved_at, tính thời gian trình ký chính xác)
 */
export async function approvePO(poId, comment = '', currentUser = null) {
  const po = await getPurchaseOrderDetail(poId);
  if (!po) throw new Error('Không tìm thấy hồ sơ PO.');

  const now = new Date();
  const currentRound = (po.current_round || 1);
  const actorId = currentUser?.id || null;
  const actorName = currentUser?.full_name || 'Lãnh đạo Phê duyệt';
  const actorRole = currentUser?.role || 'APPROVER';

  const submittedAt = po.submitted_at ? new Date(po.submitted_at) : (po.created_at ? new Date(po.created_at) : now);
  const durationHours = Math.max(0, (now.getTime() - submittedAt.getTime()) / (1000 * 3600));

  await query(
    `UPDATE purchase_orders 
     SET submission_status = 'DA_DUYET',
         approved_at = $1,
         updated_at = $1
     WHERE id = $2`,
    [now, po.id]
  );

  // Cập nhật kết quả phê duyệt vào approval_histories
  await query(
    `INSERT INTO approval_histories (id, po_id, round, stage, action, actor_id, actor_name, actor_role, comment, submitted_at, decided_at, duration_hours, created_at)
     VALUES ($1, $2, $3, 'PHE_DUYET', 'APPROVE', $4, $5, $6, $7, $8, $9, $10, $9)`,
    [crypto.randomUUID(), po.id, currentRound, actorId, actorName, actorRole, comment || 'Phê duyệt hồ sơ mua sắm', submittedAt, now, durationHours]
  );

  await query(
    `INSERT INTO lifecycle_events (id, entity_type, entity_id, event_type, po_id, object_type, object_id, previous_status, new_status, actor_id, actor_name, actor_role, event_time, note)
     VALUES ($1, 'PURCHASE_ORDER', $2, 'APPROVE', $2, 'PURCHASE_ORDER', $2, $3, 'DA_DUYET', $4, $5, $6, $7, $8)`,
    [crypto.randomUUID(), po.id, po.submission_status, actorId, actorName, actorRole, now, `Phê duyệt hoàn tất hồ sơ (Vòng ${currentRound})`]
  );

  await logAudit(actorId, actorName, actorRole, 'APPROVE', 'PURCHASE_ORDER', po.id, { submission_status: po.submission_status }, { submission_status: 'DA_DUYET', approved_at: now, duration_hours: durationHours });

  return await getPurchaseOrderDetail(po.id);
}

/**
 * Từ chối / Trả lại hồ sơ (Ghi nhận rejected_at, tăng vòng duyệt)
 */
export async function rejectPO(poId, reason = '', currentUser = null) {
  const po = await getPurchaseOrderDetail(poId);
  if (!po) throw new Error('Không tìm thấy hồ sơ PO.');

  const now = new Date();
  const currentRound = (po.current_round || 1);
  const actorId = currentUser?.id || null;
  const actorName = currentUser?.full_name || 'Lãnh đạo Phê duyệt';
  const actorRole = currentUser?.role || 'APPROVER';

  const submittedAt = po.submitted_at ? new Date(po.submitted_at) : (po.created_at ? new Date(po.created_at) : now);
  const durationHours = Math.max(0, (now.getTime() - submittedAt.getTime()) / (1000 * 3600));

  await query(
    `UPDATE purchase_orders 
     SET submission_status = 'TU_CHOI',
         rejected_at = $1,
         current_round = current_round + 1,
         updated_at = $1
     WHERE id = $2`,
    [now, po.id]
  );

  await query(
    `INSERT INTO approval_histories (id, po_id, round, stage, action, actor_id, actor_name, actor_role, comment, submitted_at, decided_at, duration_hours, created_at)
     VALUES ($1, $2, $3, 'TU_CHOI', 'REJECT', $4, $5, $6, $7, $8, $9, $10, $9)`,
    [crypto.randomUUID(), po.id, currentRound, actorId, actorName, actorRole, reason || 'Từ chối / Yêu cầu rà soát lại', submittedAt, now, durationHours]
  );

  await query(
    `INSERT INTO lifecycle_events (id, entity_type, entity_id, event_type, po_id, object_type, object_id, previous_status, new_status, actor_id, actor_name, actor_role, event_time, note)
     VALUES ($1, 'PURCHASE_ORDER', $2, 'REJECT', $2, 'PURCHASE_ORDER', $2, $3, 'TU_CHOI', $4, $5, $6, $7, $8)`,
    [crypto.randomUUID(), po.id, po.submission_status, actorId, actorName, actorRole, now, `Từ chối hồ sơ: ${reason || 'Yêu cầu rà soát lại'}`]
  );

  await logAudit(actorId, actorName, actorRole, 'REJECT', 'PURCHASE_ORDER', po.id, { submission_status: po.submission_status }, { submission_status: 'TU_CHOI', reason });

  return await getPurchaseOrderDetail(po.id);
}

/**
 * Phát hành đơn đặt hàng (Ghi nhận ordered_at)
 */
export async function orderPO(poId, orderData = {}, currentUser = null) {
  const po = await getPurchaseOrderDetail(poId);
  if (!po) throw new Error('Không tìm thấy hồ sơ PO.');

  const now = new Date();
  const actorId = currentUser?.id || null;
  const actorName = currentUser?.full_name || 'Cán bộ Mua sắm QTTS';
  const actorRole = currentUser?.role || 'QTTS';

  await query(
    `UPDATE purchase_orders 
     SET po_status = 'DA_DAT_HANG',
         ordered_at = $1,
         supplier_name = COALESCE($2, supplier_name),
         note = COALESCE($3, note),
         updated_at = $1
     WHERE id = $4`,
    [now, orderData.orderSupplier || orderData.supplier_name, orderData.note, po.id]
  );

  await query(
    `INSERT INTO lifecycle_events (id, entity_type, entity_id, event_type, po_id, object_type, object_id, previous_status, new_status, actor_id, actor_name, actor_role, event_time, note)
     VALUES ($1, 'PURCHASE_ORDER', $2, 'ORDER', $2, 'PURCHASE_ORDER', $2, $3, 'DA_DAT_HANG', $4, $5, $6, $7, $8)`,
    [crypto.randomUUID(), po.id, po.po_status, actorId, actorName, actorRole, now, `Phát hành đơn đặt hàng cho NCC: ${orderData.orderSupplier || po.supplier_name || 'NCC'}`]
  );

  await logAudit(actorId, actorName, actorRole, 'ORDER', 'PURCHASE_ORDER', po.id, { po_status: po.po_status }, { po_status: 'DA_DAT_HANG', ordered_at: now });

  return await getPurchaseOrderDetail(po.id);
}

/**
 * Giao hàng (Tạo đợt dispatch, cập nhật delivered_qty)
 */
export async function recordDelivery(poId, deliveryData = {}, currentUser = null) {
  const po = await getPurchaseOrderDetail(poId);
  if (!po) throw new Error('Không tìm thấy hồ sơ PO.');

  const now = new Date();
  const actorId = currentUser?.id || null;
  const actorName = currentUser?.full_name || 'Nhà cung cấp / Logistics';
  const actorRole = currentUser?.role || 'SUPPLIER';

  const deliveryId = crypto.randomUUID();
  const deliveryCode = `DELIV-${Date.now().toString().slice(-6)}`;

  await query(
    `INSERT INTO purchase_order_deliveries (id, po_id, delivery_code, supplier_id, delivery_date, status, carrier, tracking_number, note, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'DISPATCHED', $6, $7, $8, $9, $5, $5)`,
    [
      deliveryId,
      po.id,
      deliveryCode,
      deliveryData.supplier_id || po.supplier_id,
      now,
      deliveryData.carrier || 'Đơn vị vận chuyển',
      deliveryData.tracking_number || '',
      deliveryData.note || '',
      actorId
    ]
  );

  // Cập nhật số lượng giao cho từng món
  const itemsToDeliver = deliveryData.items || [];
  let deliveredSum = 0;
  for (const dItem of itemsToDeliver) {
    if (dItem.po_item_id && dItem.quantity > 0) {
      await query(
        `INSERT INTO delivery_items (id, delivery_id, po_item_id, quantity_delivered, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), deliveryId, dItem.po_item_id, dItem.quantity, dItem.note || '', now]
      );
      await query(
        `UPDATE purchase_order_items 
         SET delivered_qty = COALESCE(delivered_qty, 0) + $1,
             delivery_status = 'DANG_GIAO'
         WHERE id = $2`,
        [dItem.quantity, dItem.po_item_id]
      );
      deliveredSum += dItem.quantity;
    }
  }

  // Nếu không truyền danh sách cụ thể, coi như giao toàn bộ số lượng còn lại
  if (itemsToDeliver.length === 0) {
    for (const item of (po.items || [])) {
      const remaining = Math.max(0, item.qty - (item.delivered_qty || 0));
      if (remaining > 0) {
        await query(
          `INSERT INTO delivery_items (id, delivery_id, po_item_id, quantity_delivered, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [crypto.randomUUID(), deliveryId, item.id, remaining, now]
        );
        await query(
          `UPDATE purchase_order_items 
           SET delivered_qty = qty, delivery_status = 'DA_GIAO'
           WHERE id = $1`,
          [item.id]
        );
        deliveredSum += remaining;
      }
    }
  }

  // Cập nhật trạng thái giao hàng của PO
  await query(
    `UPDATE purchase_orders 
     SET delivery_status = 'DANG_GIAO',
         dispatched_at = $1,
         delivered_quantity = COALESCE(delivered_quantity, 0) + $2,
         updated_at = $1
     WHERE id = $3`,
    [now, deliveredSum, po.id]
  );

  await query(
    `INSERT INTO lifecycle_events (id, entity_type, entity_id, event_type, po_id, object_type, object_id, previous_status, new_status, actor_id, actor_name, actor_role, event_time, note)
     VALUES ($1, 'DELIVERY', $2, 'DISPATCH', $2, 'DELIVERY', $3, $4, 'DANG_GIAO', $5, $6, $7, $8, $9)`,
    [crypto.randomUUID(), po.id, deliveryId, po.delivery_status, actorId, actorName, actorRole, now, `Tạo đợt xuất hàng ${deliveryCode}: ${deliveredSum} sản phẩm`]
  );

  return await getPurchaseOrderDetail(po.id);
}

/**
 * Xác nhận nhận hàng từ Đơn vị (Tạo receipt_confirmations, cập nhật received_qty)
 * NGUYÊN TẮC: Không đánh dấu toàn PO hoàn tất khi vẫn còn dòng hàng chưa nhận đủ!
 */
export async function recordReceipt(poId, receiptData = {}, currentUser = null) {
  const po = await getPurchaseOrderDetail(poId);
  if (!po) throw new Error('Không tìm thấy hồ sơ PO.');

  const now = new Date();
  const actorId = currentUser?.id || null;
  const actorName = currentUser?.full_name || receiptData.receiver_name || 'Cán bộ Đơn vị';
  const actorRole = currentUser?.role || 'UNIT_USER';
  const defaultDept = await queryOne('SELECT id FROM departments LIMIT 1');
  const deptId = currentUser?.department_id || receiptData.department_id || defaultDept?.id || null;

  const receiptId = crypto.randomUUID();
  const receiptCode = `REC-${Date.now().toString().slice(-6)}`;

  await query(
    `INSERT INTO receipt_confirmations (id, receipt_code, po_id, department_id, received_date, status, receiver_name, receiver_id, condition_note, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'RECEIVED', $6, $7, $8, $5, $5)`,
    [
      receiptId,
      receiptCode,
      po.id,
      deptId,
      receiptData.received_date ? new Date(receiptData.received_date) : now,
      actorName,
      actorId,
      receiptData.condition_note || 'Nhận hàng đầy đủ, đúng quy cách'
    ]
  );

  const itemsReceived = receiptData.items || [];
  let totalReceivedThisBatch = 0;

  for (const rItem of itemsReceived) {
    if (rItem.po_item_id && rItem.quantity_received > 0) {
      await query(
        `INSERT INTO receipt_confirmation_items (id, receipt_id, po_item_id, quantity_received, quantity_damaged, quantity_missing, discrepancy_reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          crypto.randomUUID(),
          receiptId,
          rItem.po_item_id,
          rItem.quantity_received,
          rItem.quantity_damaged || 0,
          rItem.quantity_missing || 0,
          rItem.discrepancy_reason || '',
          now
        ]
      );
      await query(
        `UPDATE purchase_order_items 
         SET received_qty = COALESCE(received_qty, 0) + $1,
             receipt_status = CASE WHEN (COALESCE(received_qty, 0) + $1) >= qty THEN 'DA_NHAN_DU' ELSE 'NHAN_MOT_PHAN' END
         WHERE id = $2`,
        [rItem.quantity_received, rItem.po_item_id]
      );
      totalReceivedThisBatch += rItem.quantity_received;
    }
  }

  // Nếu không truyền items cụ thể, nhận toàn bộ số lượng còn lại
  if (itemsReceived.length === 0) {
    for (const item of (po.items || [])) {
      const remaining = Math.max(0, item.qty - (item.received_qty || 0));
      if (remaining > 0) {
        await query(
          `INSERT INTO receipt_confirmation_items (id, receipt_id, po_item_id, quantity_received, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [crypto.randomUUID(), receiptId, item.id, remaining, now]
        );
        await query(
          `UPDATE purchase_order_items 
           SET received_qty = qty, receipt_status = 'DA_NHAN_DU'
           WHERE id = $1`,
          [item.id]
        );
        totalReceivedThisBatch += remaining;
      }
    }
  }

  // Kiểm tra xem TẤT CẢ các dòng hàng trong PO đã nhận đủ chưa
  const updatedItems = await query('SELECT qty, received_qty FROM purchase_order_items WHERE po_id = $1', [po.id]);
  const allCompleted = updatedItems.length > 0 && updatedItems.every(it => Number(it.received_qty) >= Number(it.qty));

  if (allCompleted) {
    // Đã nhận đủ 100% tất cả các mặt hàng -> Hoàn tất PO
    await query(
      `UPDATE purchase_orders 
       SET po_status = 'HOAN_TAT',
           delivery_status = 'HOAN_TAT',
           completed_at = $1,
           received_quantity = (SELECT COALESCE(SUM(received_qty), 0) FROM purchase_order_items WHERE po_id = $2),
           updated_at = $1
       WHERE id = $2`,
      [now, po.id]
    );
  } else {
    // Vẫn còn dòng hàng chưa nhận đủ -> KHÔNG đánh dấu toàn PO hoàn tất!
    await query(
      `UPDATE purchase_orders 
       SET delivery_status = 'DA_NHAN_MOT_PHAN',
           received_quantity = (SELECT COALESCE(SUM(received_qty), 0) FROM purchase_order_items WHERE po_id = $1),
           updated_at = $2
       WHERE id = $1`,
      [po.id, now]
    );
  }

  await query(
    `INSERT INTO lifecycle_events (id, entity_type, entity_id, event_type, po_id, object_type, object_id, previous_status, new_status, actor_id, actor_name, actor_role, event_time, note)
     VALUES ($1, 'RECEIPT', $2, 'RECEIVE', $2, 'RECEIPT', $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      crypto.randomUUID(),
      po.id,
      receiptId,
      po.delivery_status,
      allCompleted ? 'HOAN_TAT' : 'DA_NHAN_MOT_PHAN',
      actorId,
      actorName,
      actorRole,
      now,
      `Biên bản xác nhận nhận hàng ${receiptCode}: ${totalReceivedThisBatch} sản phẩm.${allCompleted ? ' Đã hoàn tất 100% hồ sơ PO.' : ' Đang chờ nhận các phần còn lại.'}`
    ]
  );

  return await getPurchaseOrderDetail(po.id);
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
    `INSERT INTO lifecycle_events (id, entity_type, entity_id, event_type, po_id, object_type, object_id, previous_status, new_status, actor_id, actor_name, actor_role, event_time, note)
     VALUES ($1, 'PAYMENT_BATCH', $2, 'ACCEPT', $2, 'PAYMENT_BATCH', $2, 'PHAN_LOAI_TT', 'ACCEPT', $3, $4, $5, CURRENT_TIMESTAMP, $6)`,
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
