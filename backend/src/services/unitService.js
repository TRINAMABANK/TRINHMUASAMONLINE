import { query, queryOne } from '../config/database.js';

export async function getUnitsList() {
  const units = await query(`
    SELECT d.*,
           (SELECT COUNT(*) FROM po_item_allocations pia WHERE pia.department_id = d.id) as allocated_items_count,
           (SELECT COUNT(*) FROM receipt_confirmations rc WHERE rc.department_id = d.id) as receipt_count
    FROM departments d
    WHERE d.deleted_at IS NULL
    ORDER BY d.type ASC, d.name ASC
  `);
  return units;
}

export async function getUnitPurchaseItems(unitId, currentUser) {
  // 1. Kiểm tra RBAC: Đơn vị chỉ được xem dữ liệu của chính mình
  if (currentUser && currentUser.roles.includes('DON_VI')) {
    if (currentUser.department_id !== unitId) {
      const err = new Error('Truy cập bị từ chối: Bạn chỉ được phép tra cứu dữ liệu hàng hóa thuộc đơn vị của mình.');
      err.statusCode = 403;
      throw err;
    }
  }

  // 2. Kiểm tra tồn tại của đơn vị
  const dept = await queryOne(`SELECT * FROM departments WHERE id = $1`, [unitId]);
  if (!dept) {
    const err = new Error(`Không tìm thấy đơn vị với ID: ${unitId}`);
    err.statusCode = 404;
    throw err;
  }

  // 3. Lấy toàn bộ hàng hóa phân bổ cho đơn vị này
  const items = await query(`
    SELECT pia.id as allocation_id,
           pia.department_id, pia.department_name,
           pia.allocated_quantity,
           COALESCE((SELECT SUM(di.quantity_delivered) FROM delivery_items di WHERE di.allocation_id = pia.id), 0) as delivered_quantity,
           COALESCE((SELECT SUM(rci.quantity_received) FROM receipt_confirmation_items rci WHERE rci.allocation_id = pia.id), 0) as received_quantity,
           pia.purpose, pia.msp, pia.status as allocation_status,
           poi.id as po_item_id, poi.item_name, poi.spec, poi.unit_price,
           po.id as po_id, po.po_number, po.status as po_status, po.order_date, po.expected_delivery_date,
           s.name as supplier_name, s.code as supplier_code, s.contact_person as supplier_contact, s.phone as supplier_phone,
           pr.id as request_id, pr.request_number, pr.submission_date, pr.approved_date,
           (SELECT MAX(pod.delivery_date) FROM purchase_order_deliveries pod JOIN delivery_items di ON di.delivery_id = pod.id WHERE di.allocation_id = pia.id) as latest_delivery_date,
           (SELECT MAX(rc.received_date) FROM receipt_confirmations rc JOIN receipt_confirmation_items rci ON rci.receipt_id = rc.id WHERE rci.allocation_id = pia.id) as latest_received_date
    FROM po_item_allocations pia
    JOIN purchase_order_items poi ON poi.id = pia.po_item_id
    JOIN purchase_orders po ON po.id = pia.po_id
    JOIN suppliers s ON s.id = po.supplier_id
    LEFT JOIN procurement_requests pr ON pr.id = po.request_id
    WHERE pia.department_id = $1
    ORDER BY po.order_date DESC, poi.item_name ASC
  `, [unitId]);

  const now = Date.now();
  return items.map(it => {
    // Tính số ngày xử lý (tính từ order_date đến ngày nhận hoặc ngày hiện tại)
    const startDate = it.order_date ? new Date(it.order_date).getTime() : now;
    const endDate = it.latest_received_date ? new Date(it.latest_received_date).getTime() : now;
    const processingDays = Math.max(0, Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)));

    return {
      ...it,
      delivered_quantity: Number(it.delivered_quantity),
      received_quantity: Number(it.received_quantity),
      processing_days: processingDays
    };
  });
}

export async function getUnitPurchaseTimeline(unitId, currentUser) {
  if (currentUser && currentUser.roles.includes('DON_VI')) {
    if (currentUser.department_id !== unitId) {
      const err = new Error('Truy cập bị từ chối: Bạn chỉ được phép tra cứu dữ liệu timeline thuộc đơn vị của mình.');
      err.statusCode = 403;
      throw err;
    }
  }

  const dept = await queryOne(`SELECT * FROM departments WHERE id = $1`, [unitId]);
  if (!dept) {
    const err = new Error(`Không tìm thấy đơn vị với ID: ${unitId}`);
    err.statusCode = 404;
    throw err;
  }

  // Lấy danh sách PO liên quan đến đơn vị
  const events = await query(`
    SELECT le.*, po.po_number
    FROM lifecycle_events le
    JOIN purchase_orders po ON po.id = le.entity_id
    WHERE le.entity_type = 'PURCHASE_ORDER'
      AND EXISTS (
        SELECT 1 FROM po_item_allocations pia
        WHERE pia.po_id = po.id AND pia.department_id = $1
      )
    ORDER BY le.event_at ASC
  `, [unitId]);

  return events;
}
