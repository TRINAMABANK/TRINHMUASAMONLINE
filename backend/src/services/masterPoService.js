import crypto from 'crypto';
import { query, queryOne, transaction } from '../config/database.js';

/**
 * Sinh PO tự động theo từng Nhà cung cấp từ Hồ sơ trình ký đã duyệt (Section D)
 * Thực hiện toàn bộ trong 1 Transaction với Idempotency Key chống tạo trùng
 */
export async function generatePurchaseOrders(requestId, currentUser) {
  return await transaction(async (db) => {
    // 1. Kiểm tra hồ sơ trình ký
    const reqRes = await db.query(`SELECT * FROM procurement_requests WHERE id = $1`, [requestId]);
    const request = reqRes.rows[0];
    if (!request) {
      throw new Error(`Không tìm thấy hồ sơ trình ký với ID: ${requestId}`);
    }

    if (request.status !== 'APPROVED') {
      throw new Error(`Hồ sơ trình ký "${request.request_number}" chưa được phê duyệt (Trạng thái hiện tại: ${request.status}). Chỉ được sinh PO khi hồ sơ ở trạng thái APPROVED.`);
    }

    // 2. Lấy toàn bộ dòng hàng của hồ sơ
    const itemsRes = await db.query(
      `SELECT pri.*, s.id as real_supplier_id, s.code as supplier_code, s.name as real_supplier_name,
              d.id as real_department_id, d.name as real_department_name
       FROM procurement_request_items pri
       LEFT JOIN suppliers s ON s.id = pri.supplier_id OR LOWER(s.name) = LOWER(pri.supplier_name)
       LEFT JOIN departments d ON d.id = pri.department_id OR LOWER(d.name) = LOWER(pri.department_name)
       WHERE pri.request_id = $1
       ORDER BY pri.stt ASC`,
      [requestId]
    );

    const items = itemsRes.rows;
    if (items.length === 0) {
      throw new Error(`Hồ sơ trình ký "${request.request_number}" không có dòng hàng nào để tạo PO.`);
    }

    // 3. Nhóm các dòng hàng theo nhà cung cấp (supplier_id)
    const supplierGroups = {};
    for (const it of items) {
      const sId = it.real_supplier_id || it.supplier_id || 'UNKNOWN_SUPPLIER';
      const sName = it.real_supplier_name || it.supplier_name;
      const sCode = it.supplier_code || sName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);

      if (!supplierGroups[sId]) {
        supplierGroups[sId] = {
          supplierId: sId,
          supplierName: sName,
          supplierCode: sCode,
          items: []
        };
      }
      supplierGroups[sId].items.push(it);
    }

    const createdPOs = [];
    const now = new Date();

    // 4. Lặp qua từng nhà cung cấp, sinh 1 PO riêng biệt
    for (const sId of Object.keys(supplierGroups)) {
      const group = supplierGroups[sId];
      const idempotencyKey = `IDEMP_${requestId}_${sId}`;

      // Kiểm tra xem PO đã tồn tại chưa (Idempotency check)
      const existingPoRes = await db.query(
        `SELECT * FROM purchase_orders WHERE (request_id = $1 AND supplier_id = $2) OR idempotency_key = $3`,
        [requestId, sId, idempotencyKey]
      );

      if (existingPoRes.rows.length > 0) {
        // Đã tồn tại PO cho NCC này -> Giữ nguyên, không tạo trùng
        createdPOs.push(existingPoRes.rows[0]);
        continue;
      }

      // Đặt mã PO chuẩn: [Mã Yêu Cầu]-[Mã NCC] (VD: PO-2026-00048-FTI)
      const poNumber = request.request_number.replace('PYC', 'PO') + '-' + group.supplierCode;
      const poId = crypto.randomUUID();

      // Xác định payment_group tổng hợp của PO
      const allPayGroups = new Set(group.items.map(x => x.payment_group));
      let poPaymentGroup = 'HON_HOP';
      if (allPayGroups.size === 1) {
        poPaymentGroup = Array.from(allPayGroups)[0];
      }

      let poTotalAmount = 0;
      let poTotalQty = 0;

      // Tạo Purchase Order
      await db.query(
        `INSERT INTO purchase_orders (
          id, po_number, request_id, supplier_id, supplier_name, order_date,
          status, total_amount, total_quantity, payment_group, idempotency_key, note, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          poId, poNumber, requestId, sId, group.supplierName, now,
          'ISSUED', 0, 0, poPaymentGroup, idempotencyKey,
          `PO tự động theo đợt từ hồ sơ ${request.request_number}`, currentUser?.id || null
        ]
      );

      // Nhóm mặt hàng theo tên & quy cách để tạo purchase_order_items
      const distinctItems = {};
      for (const it of group.items) {
        const itemKey = `${it.item_name}__${it.spec || ''}__${it.unit_price}`;
        if (!distinctItems[itemKey]) {
          distinctItems[itemKey] = {
            itemName: it.item_name,
            spec: it.spec,
            unitPrice: Number(it.unit_price),
            quantity: 0,
            amount: 0,
            sourceRows: []
          };
        }
        distinctItems[itemKey].quantity += Number(it.quantity);
        distinctItems[itemKey].amount += Number(it.amount);
        distinctItems[itemKey].sourceRows.push(it);
      }

      // Tạo purchase_order_items và po_item_allocations
      for (const key of Object.keys(distinctItems)) {
        const dIt = distinctItems[key];
        const poItemId = crypto.randomUUID();

        await db.query(
          `INSERT INTO purchase_order_items (
            id, po_id, item_name, spec, quantity, unit_price, amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [poItemId, poId, dIt.itemName, dIt.spec, dIt.quantity, dIt.unitPrice, dIt.amount]
        );

        poTotalAmount += dIt.amount;
        poTotalQty += dIt.quantity;

        // Lưu liên kết nguồn và phân bổ đơn vị
        for (const sRow of dIt.sourceRows) {
          // po_source_items
          await db.query(
            `INSERT INTO po_source_items (id, po_id, po_item_id, source_item_id, quantity, amount)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [crypto.randomUUID(), poId, poItemId, sRow.id, sRow.quantity, sRow.amount]
          );

          // po_item_allocations
          const deptId = sRow.real_department_id || sRow.department_id;
          const deptName = sRow.real_department_name || sRow.department_name;

          await db.query(
            `INSERT INTO po_item_allocations (
              id, po_id, po_item_id, department_id, department_name,
              allocated_quantity, purpose, msp, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              crypto.randomUUID(), poId, poItemId, deptId, deptName,
              sRow.quantity, sRow.purpose, sRow.msp, 'PENDING'
            ]
          );
        }
      }

      // Cập nhật tổng tiền và số lượng thực tế của PO
      await db.query(
        `UPDATE purchase_orders SET total_amount = $1, total_quantity = $2 WHERE id = $3`,
        [poTotalAmount, poTotalQty, poId]
      );

      // Ghi lifecycle event
      await db.query(
        `INSERT INTO lifecycle_events (
          id, entity_type, entity_id, event_type, old_status, new_status, actor_id, actor_name, event_at, note
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          crypto.randomUUID(), 'PURCHASE_ORDER', poId, 'PO_GENERATED',
          null, 'ISSUED', currentUser?.id || null, currentUser?.full_name || 'Hệ thống',
          now, `Tự động tạo PO số ${poNumber} cho NCC ${group.supplierName}`
        ]
      );

      const createdPo = await db.query(`SELECT * FROM purchase_orders WHERE id = $1`, [poId]);
      createdPOs.push(createdPo.rows[0]);
    }

    return createdPOs;
  });
}

/**
 * Tra cứu Sổ Master PO với bộ lọc đa tiêu chí (Section F)
 */
export async function getMasterPOsList(filters = {}, currentUser = null) {
  let whereClauses = ['po.deleted_at IS NULL'];
  let params = [];
  let pIdx = 1;

  // RBAC phân quyền bảo vệ
  if (currentUser) {
    if (currentUser.roles.includes('DON_VI')) {
      // Đơn vị chỉ thấy PO có mặt hàng phân bổ cho đơn vị mình
      whereClauses.push(`EXISTS (
        SELECT 1 FROM po_item_allocations pia
        WHERE pia.po_id = po.id AND pia.department_id = $${pIdx}
      )`);
      params.push(currentUser.department_id);
      pIdx++;
    } else if (currentUser.roles.includes('SUPPLIER')) {
      // Nhà cung cấp chỉ thấy PO của mình
      whereClauses.push(`po.supplier_id = $${pIdx}`);
      params.push(currentUser.supplier_id);
      pIdx++;
    }
  }

  // Bộ lọc mã PO
  if (filters.po_number) {
    whereClauses.push(`po.po_number ILIKE $${pIdx}`);
    params.push(`%${filters.po_number}%`);
    pIdx++;
  }

  // Bộ lọc NCC
  if (filters.supplier_id) {
    whereClauses.push(`po.supplier_id = $${pIdx}`);
    params.push(filters.supplier_id);
    pIdx++;
  } else if (filters.supplier_name) {
    whereClauses.push(`po.supplier_name ILIKE $${pIdx}`);
    params.push(`%${filters.supplier_name}%`);
    pIdx++;
  }

  // Bộ lọc tên hàng
  if (filters.item_name) {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM purchase_order_items poi
      WHERE poi.po_id = po.id AND poi.item_name ILIKE $${pIdx}
    )`);
    params.push(`%${filters.item_name}%`);
    pIdx++;
  }

  // Bộ lọc đơn vị nhận hàng
  if (filters.department_id) {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM po_item_allocations pia
      WHERE pia.po_id = po.id AND pia.department_id = $${pIdx}
    )`);
    params.push(filters.department_id);
    pIdx++;
  } else if (filters.unit_name) {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM po_item_allocations pia
      WHERE pia.po_id = po.id AND pia.department_name ILIKE $${pIdx}
    )`);
    params.push(`%${filters.unit_name}%`);
    pIdx++;
  }

  // Bộ lọc trạng thái
  if (filters.status) {
    whereClauses.push(`po.status = $${pIdx}`);
    params.push(filters.status);
    pIdx++;
  }

  // Bộ lọc Nhóm TT
  if (filters.payment_group) {
    whereClauses.push(`po.payment_group = $${pIdx}`);
    params.push(filters.payment_group);
    pIdx++;
  }

  // Bộ lọc thời gian
  if (filters.from_date) {
    whereClauses.push(`po.order_date >= $${pIdx}`);
    params.push(new Date(filters.from_date));
    pIdx++;
  }
  if (filters.to_date) {
    whereClauses.push(`po.order_date <= $${pIdx}`);
    params.push(new Date(filters.to_date));
    pIdx++;
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT po.*,
           pr.request_number, pr.title as request_title,
           s.code as supplier_code, s.contact_person as supplier_contact, s.phone as supplier_phone,
           (SELECT COUNT(DISTINCT department_id) FROM po_item_allocations pia WHERE pia.po_id = po.id) as unit_count,
           (SELECT COUNT(*) FROM purchase_order_deliveries pod WHERE pod.po_id = po.id) as delivery_batch_count,
           (SELECT COUNT(*) FROM receipt_confirmations rc WHERE rc.po_id = po.id) as receipt_count,
           COALESCE((SELECT SUM(quantity_delivered) FROM delivery_items di JOIN purchase_order_deliveries pod ON pod.id = di.delivery_id WHERE pod.po_id = po.id), 0) as calc_delivered_qty,
           COALESCE((SELECT SUM(quantity_received) FROM receipt_confirmation_items rci JOIN receipt_confirmations rc ON rc.id = rci.receipt_id WHERE rc.po_id = po.id), 0) as calc_received_qty
    FROM purchase_orders po
    LEFT JOIN procurement_requests pr ON pr.id = po.request_id
    LEFT JOIN suppliers s ON s.id = po.supplier_id
    ${whereSQL}
    ORDER BY po.order_date DESC, po.po_number DESC
  `;

  const rows = await query(sql, params);

  // Tính tỷ lệ hoàn tất
  return rows.map(r => {
    const total = Number(r.total_quantity || 0);
    const delivered = Number(r.calc_delivered_qty || r.delivered_quantity || 0);
    const received = Number(r.calc_received_qty || r.received_quantity || 0);

    return {
      ...r,
      delivered_quantity: delivered,
      received_quantity: received,
      delivery_progress: total > 0 ? Math.min(100, Math.round((delivered / total) * 100)) : 0,
      receipt_progress: total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0
    };
  });
}

/**
 * Lấy chi tiết 1 PO kèm mặt hàng, phân bổ, đợt giao và biên bản nhận
 */
export async function getPurchaseOrderDetail(poId, currentUser = null) {
  const po = await queryOne(`
    SELECT po.*, pr.request_number, pr.title as request_title, pr.approved_date,
           s.name as supplier_name, s.code as supplier_code, s.email as supplier_email,
           s.phone as supplier_phone, s.contact_person as supplier_contact
    FROM purchase_orders po
    LEFT JOIN procurement_requests pr ON pr.id = po.request_id
    LEFT JOIN suppliers s ON s.id = po.supplier_id
    WHERE po.id = $1 AND po.deleted_at IS NULL
  `, [poId]);

  if (!po) return null;

  // Kiểm tra quyền
  if (currentUser) {
    if (currentUser.roles.includes('SUPPLIER') && currentUser.supplier_id !== po.supplier_id) {
      throw new Error('Bạn không có quyền xem PO của nhà cung cấp khác.');
    }
  }

  // Danh sách mặt hàng
  const items = await query(`
    SELECT poi.*,
           COALESCE((SELECT SUM(quantity_delivered) FROM delivery_items di WHERE di.po_item_id = poi.id), 0) as actual_delivered,
           COALESCE((SELECT SUM(quantity_received) FROM receipt_confirmation_items rci WHERE rci.po_item_id = poi.id), 0) as actual_received
    FROM purchase_order_items poi
    WHERE poi.po_id = $1
    ORDER BY poi.item_name ASC
  `, [poId]);

  // Danh sách phân bổ cho các đơn vị
  const allocations = await query(`
    SELECT pia.*, d.code as department_code, d.type as department_type, d.region as department_region
    FROM po_item_allocations pia
    LEFT JOIN departments d ON d.id = pia.department_id
    WHERE pia.po_id = $1
    ORDER BY pia.department_name ASC, pia.created_at ASC
  `, [poId]);

  // Các đợt giao hàng
  const deliveries = await query(`
    SELECT pod.*,
           (SELECT COUNT(*) FROM delivery_items di WHERE di.delivery_id = pod.id) as item_count,
           COALESCE((SELECT SUM(quantity_delivered) FROM delivery_items di WHERE di.delivery_id = pod.id), 0) as total_delivered_in_batch
    FROM purchase_order_deliveries pod
    WHERE pod.po_id = $1
    ORDER BY pod.delivery_date DESC
  `, [poId]);

  // Các biên bản nhận hàng
  const receipts = await query(`
    SELECT rc.*, d.name as department_name, d.code as department_code,
           COALESCE((SELECT SUM(quantity_received) FROM receipt_confirmation_items rci WHERE rci.receipt_id = rc.id), 0) as total_received_in_batch,
           COALESCE((SELECT SUM(quantity_damaged) FROM receipt_confirmation_items rci WHERE rci.receipt_id = rc.id), 0) as total_damaged_in_batch,
           COALESCE((SELECT SUM(quantity_missing) FROM receipt_confirmation_items rci WHERE rci.receipt_id = rc.id), 0) as total_missing_in_batch
    FROM receipt_confirmations rc
    LEFT JOIN departments d ON d.id = rc.department_id
    WHERE rc.po_id = $1
    ORDER BY rc.received_date DESC
  `, [poId]);

  // Lịch sử timeline sự kiện
  const timeline = await query(`
    SELECT * FROM lifecycle_events
    WHERE entity_type = 'PURCHASE_ORDER' AND entity_id = $1
    ORDER BY event_at ASC
  `, [poId]);

  po.items = items;
  po.allocations = allocations;
  po.deliveries = deliveries;
  po.receipts = receipts;
  po.timeline = timeline;

  return po;
}

export async function getPurchaseOrderItems(poId) {
  return await query(`
    SELECT * FROM purchase_order_items WHERE po_id = $1 ORDER BY item_name ASC
  `, [poId]);
}

export async function getPurchaseOrderAllocations(poId) {
  return await query(`
    SELECT pia.*, d.code as department_code, d.type as department_type
    FROM po_item_allocations pia
    LEFT JOIN departments d ON d.id = pia.department_id
    WHERE pia.po_id = $1
    ORDER BY pia.department_name ASC
  `, [poId]);
}
