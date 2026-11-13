import crypto from 'crypto';
import { query, queryOne } from '../config/database.js';
import { logAudit } from '../middlewares/errorHandler.js';

export async function getUnitsList() {
  const units = await query(`
    SELECT d.*,
           (SELECT COUNT(*) FROM purchase_order_items poi WHERE LOWER(poi.unit_name) LIKE LOWER('%' || d.name || '%') OR poi.department_id = d.id) as allocated_items_count,
           (SELECT COUNT(*) FROM receipt_confirmations rc WHERE rc.department_id = d.id) as receipt_count
    FROM departments d
    WHERE d.deleted_at IS NULL
    ORDER BY d.type ASC, d.name ASC
  `);
  return units;
}

/**
 * Lấy các chỉ số Dashboard dành riêng cho Đơn vị chuẩn Section IV
 * Tự động xác định đơn vị dựa trên tài khoản đăng nhập (Không tin mã đơn vị frontend tự gửi lên!)
 */
export async function getUnitDashboardStats(unitId, currentUser) {
  let effectiveUnitId = unitId;

  // 1. Phân quyền: UNIT_USER hoặc DON_VI tuyệt đối bị cố định vào đơn vị của mình từ database
  if (currentUser && (currentUser.role === 'UNIT_USER' || currentUser.roles?.includes('DON_VI'))) {
    effectiveUnitId = currentUser.department_id;
  }

  // 2. Tìm thông tin đơn vị
  let dept = null;
  if (effectiveUnitId) {
    dept = await queryOne('SELECT * FROM departments WHERE id = $1', [effectiveUnitId]);
  }

  const deptFilter = dept
    ? `(poi.department_id = $1 OR LOWER(poi.unit_name) LIKE LOWER($2) OR LOWER(poi.unit_name) LIKE LOWER($3))`
    : '1=1';
  const params = dept ? [dept.id, `%${dept.name}%`, `%${dept.code}%`] : [];

  // Lấy toàn bộ items thuộc đơn vị
  const items = await query(
    `SELECT poi.*, po.po_number, po.submission_status, po.po_status, po.delivery_status as po_delivery_status
     FROM purchase_order_items poi
     JOIN purchase_orders po ON po.id = poi.po_id
     WHERE ${deptFilter}`,
    params
  );

  const totalRequests = items.length;
  const inPoRequests = items.length; // Mỗi dòng hàng trong purchase_order_items đều đã vào PO

  // Lấy các PO duy nhất liên quan đến đơn vị
  const poIds = Array.from(new Set(items.map(it => it.po_id)));
  let approvedPOs = 0;
  let orderedPOs = 0;

  if (poIds.length > 0) {
    const poStats = await query(
      `SELECT COUNT(*) FILTER (WHERE submission_status = 'DA_DUYET') as approved_count,
              COUNT(*) FILTER (WHERE po_status = 'DA_DAT_HANG' OR po_status = 'DOI_TAC_XAC_NHAN' OR po_status = 'HOAN_TAT') as ordered_count
       FROM purchase_orders
       WHERE id IN (${poIds.map((_, i) => `$${i + 1}`).join(',')})`,
      poIds
    );
    approvedPOs = Number(poStats[0]?.approved_count || 0);
    orderedPOs = Number(poStats[0]?.ordered_count || 0);
  }

  // Số mặt hàng đang giao, đã nhận, chưa nhận
  let shippingItems = 0;
  let receivedItems = 0;
  let unreceivedItems = 0;

  for (const it of items) {
    const qty = Number(it.qty) || 1;
    const rQty = Number(it.received_qty) || 0;
    const dQty = Number(it.delivered_qty) || 0;

    if (rQty >= qty) {
      receivedItems++;
    } else {
      unreceivedItems++;
      if (dQty > rQty || it.delivery_status === 'DANG_GIAO' || it.po_delivery_status === 'DANG_GIAO') {
        shippingItems++;
      }
    }
  }

  return {
    unit: dept ? { id: dept.id, code: dept.code, name: dept.name } : null,
    totalRequests,
    inPoRequests,
    approvedPOs,
    orderedPOs,
    shippingItems,
    receivedItems,
    unreceivedItems
  };
}

/**
 * Bảng tra cứu hàng hóa Đơn vị chuẩn 11 cột Section IV
 */
export async function getUnitSearchItems(filters = {}, currentUser = null) {
  let effectiveUnitId = filters.unit_id;

  // 1. Bảo mật: Tự xác định đơn vị dựa trên tài khoản đăng nhập (Không tin mã frontend gửi lên)
  if (currentUser && (currentUser.role === 'UNIT_USER' || currentUser.roles?.includes('DON_VI'))) {
    effectiveUnitId = currentUser.department_id;
  }

  let dept = null;
  if (effectiveUnitId) {
    dept = await queryOne('SELECT * FROM departments WHERE id = $1', [effectiveUnitId]);
  }

  let whereClauses = [];
  let params = [];
  let pIdx = 1;

  if (dept) {
    whereClauses.push(`(poi.department_id = $${pIdx} OR LOWER(poi.unit_name) LIKE LOWER($${pIdx + 1}) OR LOWER(poi.unit_name) LIKE LOWER($${pIdx + 2}))`);
    params.push(dept.id, `%${dept.name}%`, `%${dept.code}%`);
    pIdx += 3;
  }

  // Tìm kiếm theo từ khóa tổng quát
  if (filters.q) {
    const qTerm = `%${filters.q.trim()}%`;
    whereClauses.push(`(
      poi.item_name ILIKE $${pIdx} OR
      po.po_number ILIKE $${pIdx} OR
      poi.supplier_name ILIKE $${pIdx} OR
      poi.msp ILIKE $${pIdx}
    )`);
    params.push(qTerm);
    pIdx++;
  }

  // Tìm theo tên hàng hóa
  if (filters.item_name) {
    whereClauses.push(`poi.item_name ILIKE $${pIdx}`);
    params.push(`%${filters.item_name}%`);
    pIdx++;
  }

  // Tìm theo mã PO
  if (filters.po_number) {
    whereClauses.push(`po.po_number ILIKE $${pIdx}`);
    params.push(`%${filters.po_number}%`);
    pIdx++;
  }

  // Tìm theo ngày đề xuất
  if (filters.request_date) {
    whereClauses.push(`poi.request_date ILIKE $${pIdx}`);
    params.push(`%${filters.request_date}%`);
    pIdx++;
  }

  // Tìm theo nhà cung cấp
  if (filters.supplier_name) {
    whereClauses.push(`poi.supplier_name ILIKE $${pIdx}`);
    params.push(`%${filters.supplier_name}%`);
    pIdx++;
  }

  // Tìm theo trạng thái trình ký
  if (filters.submission_status) {
    whereClauses.push(`po.submission_status = $${pIdx}`);
    params.push(filters.submission_status);
    pIdx++;
  }

  // Tìm theo trạng thái giao nhận
  if (filters.delivery_status) {
    whereClauses.push(`(poi.delivery_status = $${pIdx} OR po.delivery_status = $${pIdx})`);
    params.push(filters.delivery_status);
    pIdx++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT poi.id as item_id,
           poi.po_id,
           poi.stt,
           poi.request_date,
           poi.item_name,
           poi.qty,
           poi.spec,
           poi.unit_price,
           poi.amount,
           poi.unit_name,
           poi.department_id,
           poi.purpose,
           poi.msp,
           poi.pay_group,
           poi.delivered_qty,
           poi.received_qty,
           poi.delivery_status as item_delivery_status,
           poi.receipt_status as item_receipt_status,
           poi.expected_delivery_date as item_expected_date,
           po.po_number,
           po.order_date,
           po.submission_status,
           po.approved_at,
           po.ordered_at,
           po.supplier_name as po_supplier_name,
           COALESCE(poi.supplier_name, po.supplier_name, 'Chưa chỉ định') as supplier_name,
           po.expected_delivery_date as po_expected_date,
           po.delivery_status as po_delivery_status,
           po.po_status
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.po_id
    ${whereSql}
    ORDER BY po.order_date DESC, poi.stt ASC
  `;

  const rows = await query(sql, params);

  // Chuẩn hóa đúng 11 cột hiển thị cho UNIT_USER
  return rows.map(r => {
    const qty = Number(r.qty) || 1;
    const rQty = Number(r.received_qty) || 0;
    const dQty = Number(r.delivered_qty) || 0;

    // Trạng thái nhận hàng
    let receiptStatus = 'Chưa nhận';
    if (rQty >= qty) {
      receiptStatus = 'Đã nhận đủ';
    } else if (rQty > 0) {
      receiptStatus = `Nhận một phần (${rQty}/${qty})`;
    }

    // Tình trạng giao hàng
    let deliveryStatus = 'Chưa giao';
    if (dQty >= qty) {
      deliveryStatus = 'Đã giao tới đơn vị';
    } else if (dQty > 0 || r.po_delivery_status === 'DANG_GIAO' || r.item_delivery_status === 'DANG_GIAO') {
      deliveryStatus = 'Đang giao hàng';
    }

    // Trạng thái trình ký
    let submissionStatusText = 'Chờ trình ký';
    if (r.submission_status === 'DA_DUYET') {
      submissionStatusText = 'Đã duyệt';
    } else if (r.submission_status === 'TU_CHOI') {
      submissionStatusText = 'Từ chối';
    } else if (r.submission_status === 'DANG_TRINH_KY') {
      submissionStatusText = 'Đang trình ký';
    }

    return {
      item_id: r.item_id,
      po_id: r.po_id,
      request_date: r.request_date || (r.order_date ? new Date(r.order_date).toISOString().slice(0, 10) : '—'),
      item_name: r.item_name,
      spec: r.spec || 'CÁI',
      qty: qty,
      po_number: r.po_number,
      submission_status: submissionStatusText,
      approved_at: r.approved_at ? new Date(r.approved_at).toLocaleDateString('vi-VN') : '—',
      supplier_name: r.supplier_name,
      expected_delivery_date: r.item_expected_date
        ? new Date(r.item_expected_date).toLocaleDateString('vi-VN')
        : r.po_expected_date
          ? new Date(r.po_expected_date).toLocaleDateString('vi-VN')
          : 'Đang sắp xếp',
      delivery_status: deliveryStatus,
      received_qty: rQty,
      receipt_status: receiptStatus,
      unit_name: r.unit_name,
      msp: r.msp,
      can_confirm: rQty < qty
    };
  });
}

/**
 * Xác nhận nhận hàng từ Đơn vị chuẩn RBAC
 * Chỉ UNIT_USER và ADMIN được xác nhận. VIEWER bị chặn hoàn toàn!
 */
export async function confirmUnitReceipt(receiptData, currentUser) {
  // 1. Kiểm tra RBAC
  if (!currentUser) {
    const err = new Error('Yêu cầu đăng nhập để thực hiện xác nhận.');
    err.statusCode = 401;
    throw err;
  }

  if (currentUser.role === 'VIEWER') {
    const err = new Error('Truy cập bị từ chối: Tài khoản Người xem (VIEWER) chỉ có quyền tra cứu, không được xác nhận nhận hàng.');
    err.statusCode = 403;
    throw err;
  }

  const { item_id, quantity_received, received_date, condition_note } = receiptData;
  if (!item_id) {
    const err = new Error('Thiếu mã mặt hàng (item_id).');
    err.statusCode = 400;
    throw err;
  }

  const item = await queryOne('SELECT * FROM purchase_order_items WHERE id = $1', [item_id]);
  if (!item) {
    const err = new Error('Không tìm thấy mặt hàng cần xác nhận.');
    err.statusCode = 404;
    throw err;
  }

  const numReceived = Number(quantity_received) || item.qty;
  const now = new Date();
  const receiverName = currentUser.full_name || 'Cán bộ Đơn vị';
  const receiverId = currentUser.id;
  const deptId = currentUser.department_id || item.department_id || null;

  // Tạo receipt confirmation
  const receiptId = crypto.randomUUID();
  const receiptCode = `REC-UNIT-${Date.now().toString().slice(-6)}`;

  await query(
    `INSERT INTO receipt_confirmations (id, receipt_code, po_id, department_id, received_date, status, receiver_name, receiver_id, condition_note, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'RECEIVED', $6, $7, $8, $5, $5)`,
    [
      receiptId,
      receiptCode,
      item.po_id,
      deptId,
      received_date ? new Date(received_date) : now,
      receiverName,
      receiverId,
      condition_note || 'Xác nhận nhận hàng thực tế từ Đơn vị'
    ]
  );

  await query(
    `INSERT INTO receipt_confirmation_items (id, receipt_id, po_item_id, quantity_received, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [crypto.randomUUID(), receiptId, item.id, numReceived, now]
  );

  // Cập nhật purchase_order_items
  const newReceivedQty = Math.min(Number(item.qty), (Number(item.received_qty) || 0) + numReceived);
  await query(
    `UPDATE purchase_order_items
     SET received_qty = $1,
         receipt_status = CASE WHEN $1 >= qty THEN 'DA_NHAN_DU' ELSE 'NHAN_MOT_PHAN' END,
         updated_at = $2
     WHERE id = $3`,
    [newReceivedQty, now, item.id]
  );

  // Kiểm tra tổng thể PO
  const updatedItems = await query('SELECT qty, received_qty FROM purchase_order_items WHERE po_id = $1', [item.po_id]);
  const allCompleted = updatedItems.length > 0 && updatedItems.every(it => Number(it.received_qty) >= Number(it.qty));

  if (allCompleted) {
    await query(
      `UPDATE purchase_orders 
       SET po_status = 'HOAN_TAT',
           delivery_status = 'HOAN_TAT',
           completed_at = $1,
           received_quantity = (SELECT COALESCE(SUM(received_qty), 0) FROM purchase_order_items WHERE po_id = $2),
           updated_at = $1
       WHERE id = $2`,
      [now, item.po_id]
    );
  } else {
    await query(
      `UPDATE purchase_orders 
       SET delivery_status = 'DA_NHAN_MOT_PHAN',
           received_quantity = (SELECT COALESCE(SUM(received_qty), 0) FROM purchase_order_items WHERE po_id = $1),
           updated_at = $2
       WHERE id = $1`,
      [item.po_id, now]
    );
  }

  // Audit log
  await logAudit(receiverId, receiverName, currentUser.role, 'UNIT_CONFIRM_RECEIPT', 'PURCHASE_ORDER_ITEM', item.id, { old_received: item.received_qty }, { new_received: newReceivedQty, code: receiptCode });

  return {
    success: true,
    message: `Đã xác nhận nhận ${numReceived} sản phẩm "${item.item_name}". Biên bản: ${receiptCode}`,
    item_id: item.id,
    new_received_qty: newReceivedQty,
    is_po_completed: allCompleted
  };
}
