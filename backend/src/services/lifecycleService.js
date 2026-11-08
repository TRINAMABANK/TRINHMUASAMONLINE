import { query, queryOne } from '../config/database.js';

export const STAGES = [
  { code: 'PHIEU_TRINH_XUAT', label: '1. Phiếu trình được xuất', order: 1 },
  { code: 'CHO_DUYET', label: '2. Chờ duyệt', order: 2 },
  { code: 'DA_DUYET', label: '3. Đã duyệt', order: 3 },
  { code: 'DA_DAT_HANG', label: '4. Đã đặt hàng / Có PO', order: 4 },
  { code: 'DOI_TAC_XAC_NHAN', label: '5. Đối tác xác nhận đơn', order: 5 },
  { code: 'DANG_GIAO_HANG', label: '6. Đang giao hàng', order: 6 },
  { code: 'DOI_TAC_DA_GIAO', label: '7. Đối tác xác nhận đã giao', order: 7 },
  { code: 'DON_VI_DA_NHAN', label: '8. Đơn vị xác nhận đã nhận', order: 8 },
  { code: 'HOAN_TAT', label: '9. Hoàn tất', order: 9 }
];

/**
 * Tính toán dòng thời gian xử lý và các chỉ số đo lường cho một hồ sơ PO
 */
export async function calculatePoTimeline(poId) {
  const po = await queryOne(
    `SELECT po.*, lc.*
     FROM purchase_orders po
     LEFT JOIN procurement_lifecycles lc ON po.id = lc.po_id
     WHERE po.id = $1`,
    [poId]
  );

  if (!po) return null;

  const events = await query(
    `SELECT * FROM lifecycle_events WHERE po_id = $1 ORDER BY event_time ASC`,
    [poId]
  );

  const now = new Date();
  const createdTime = new Date(po.created_at || po.exported_at || now);

  // Tính các mốc thời gian giữa các công đoạn
  const tExport = po.exported_at ? new Date(po.exported_at) : createdTime;
  const tApprove = po.approved_at ? new Date(po.approved_at) : null;
  const tOrder = po.ordered_at ? new Date(po.ordered_at) : null;
  const tVendorConfirm = po.vendor_confirmed_at ? new Date(po.vendor_confirmed_at) : null;
  const tShipped = po.shipped_at ? new Date(po.shipped_at) : null;
  const tDelivered = po.delivered_at ? new Date(po.delivered_at) : null;
  const tReceived = po.received_at ? new Date(po.received_at) : null;
  const tCompleted = po.completed_at ? new Date(po.completed_at) : null;

  // Tính số giờ / ngày giữa các giai đoạn
  const diffHours = (t1, t2) => (t1 && t2 ? Math.round(((t2 - t1) / (1000 * 60 * 60)) * 10) / 10 : null);
  const diffDays = (t1, t2) => (t1 && t2 ? Math.round(((t2 - t1) / (1000 * 60 * 60 * 24)) * 10) / 10 : null);

  const durationExportToApprove = diffHours(tExport, tApprove);
  const durationApproveToOrder = diffHours(tApprove, tOrder);
  const durationOrderToVendor = diffHours(tOrder, tVendorConfirm);
  const durationOrderToShipped = diffHours(tOrder, tShipped);
  const durationShippedToReceived = diffHours(tShipped, tReceived);
  const totalLifecycleHours = diffHours(tExport, tCompleted || now);
  const totalLifecycleDays = diffDays(tExport, tCompleted || now);

  // Thời gian đang chờ ở công đoạn hiện tại
  const lastEventTime = events.length > 0 ? new Date(events[events.length - 1].event_time) : createdTime;
  const currentWaitingHours = Math.round(((now - lastEventTime) / (1000 * 60 * 60)) * 10) / 10;
  const currentWaitingDays = Math.round(((now - lastEventTime) / (1000 * 60 * 60 * 24)) * 10) / 10;

  // Xác định ngày dự kiến giao gần nhất từ deliveries
  const latestDelivery = await queryOne(
    `SELECT expected_delivery_date, actual_delivery_date, status 
     FROM purchase_order_deliveries WHERE po_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [poId]
  );

  let daysOverdue = 0;
  let isDelayed = false;

  if (latestDelivery && latestDelivery.expected_delivery_date) {
    const expected = new Date(latestDelivery.expected_delivery_date);
    const compareTime = latestDelivery.actual_delivery_date ? new Date(latestDelivery.actual_delivery_date) : now;
    if (compareTime > expected && po.delivery_status !== 'HOAN_TAT') {
      daysOverdue = Math.max(0, Math.ceil((compareTime - expected) / (1000 * 60 * 60 * 24)));
      isDelayed = daysOverdue > 0;
    }
  }

  return {
    po_id: poId,
    po_number: po.po_number,
    current_stage: po.current_stage || 'PHIEU_TRINH_XUAT',
    submission_status: po.submission_status,
    po_status: po.po_status,
    delivery_status: po.delivery_status,
    durations: {
      export_to_approve_hours: durationExportToApprove,
      approve_to_order_hours: durationApproveToOrder,
      order_to_vendor_hours: durationOrderToVendor,
      order_to_shipped_hours: durationOrderToShipped,
      shipped_to_received_hours: durationShippedToReceived,
      total_lifecycle_hours: totalLifecycleHours,
      total_lifecycle_days: totalLifecycleDays,
      current_waiting_hours: currentWaitingHours,
      current_waiting_days: currentWaitingDays
    },
    sla: {
      target_hours: po.sla_target_hours || 120,
      is_overdue: isDelayed || po.is_overdue || false,
      days_overdue: daysOverdue,
      expected_delivery_date: latestDelivery ? latestDelivery.expected_delivery_date : null,
      actual_delivery_date: latestDelivery ? latestDelivery.actual_delivery_date : null
    },
    stages: STAGES.map(s => {
      let isCompleted = false;
      let timestamp = null;

      if (s.code === 'PHIEU_TRINH_XUAT') { isCompleted = !!tExport; timestamp = tExport; }
      else if (s.code === 'CHO_DUYET') { isCompleted = po.submission_status === 'CHO_DUYET' || !!tApprove; timestamp = tExport; }
      else if (s.code === 'DA_DUYET') { isCompleted = !!tApprove; timestamp = tApprove; }
      else if (s.code === 'DA_DAT_HANG') { isCompleted = !!tOrder; timestamp = tOrder; }
      else if (s.code === 'DOI_TAC_XAC_NHAN') { isCompleted = !!tVendorConfirm; timestamp = tVendorConfirm; }
      else if (s.code === 'DANG_GIAO_HANG') { isCompleted = !!tShipped; timestamp = tShipped; }
      else if (s.code === 'DOI_TAC_DA_GIAO') { isCompleted = !!tDelivered; timestamp = tDelivered; }
      else if (s.code === 'DON_VI_DA_NHAN') { isCompleted = !!tReceived; timestamp = tReceived; }
      else if (s.code === 'HOAN_TAT') { isCompleted = !!tCompleted || po.delivery_status === 'HOAN_TAT'; timestamp = tCompleted; }

      return {
        ...s,
        is_completed: isCompleted,
        timestamp: timestamp ? timestamp.toISOString() : null
      };
    }),
    events
  };
}

/**
 * Thống kê toàn bộ chỉ số KPI cho Dashboard Mua Sắm & Vòng Đời
 */
export async function getDashboardKPIs(filters = {}, currentUser = null) {
  // Lấy danh sách PO phù hợp với quyền và bộ lọc
  let whereClauses = [];
  let params = [];
  let pIdx = 1;

  if (currentUser) {
    if (currentUser.role === 'UNIT_USER') {
      const dept = await queryOne('SELECT name, code FROM departments WHERE id = $1', [currentUser.department_id]);
      if (dept) {
        whereClauses.push(`EXISTS (
          SELECT 1 FROM purchase_order_items poi 
          WHERE poi.po_id = po.id AND (poi.unit_name ILIKE $${pIdx} OR poi.unit_name ILIKE $${pIdx + 1})
        )`);
        params.push(`%${dept.name}%`, `%${dept.code}%`);
        pIdx += 2;
      }
    } else if (currentUser.role === 'SUPPLIER') {
      whereClauses.push(`EXISTS (
        SELECT 1 FROM purchase_order_items poi
        JOIN suppliers s ON LOWER(poi.supplier_name) = LOWER(s.name)
        WHERE poi.po_id = po.id AND s.id = $${pIdx}
      )`);
      params.push(currentUser.supplier_id);
      pIdx++;
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const allPOs = await query(
    `SELECT po.id, po.po_number, po.submission_status, po.po_status, po.delivery_status,
            po.total_amount, po.total_qty, po.created_at,
            lc.current_stage, lc.is_overdue, lc.exported_at, lc.approved_at, lc.ordered_at, lc.completed_at
     FROM purchase_orders po
     LEFT JOIN procurement_lifecycles lc ON po.id = lc.po_id
     ${whereSql}`,
    params
  );

  const totalPOs = allPOs.length;
  const countPendingApproval = allPOs.filter(p => p.submission_status === 'CHO_DUYET' || p.submission_status === 'KHOI_TAO').length;
  const countApproved = allPOs.filter(p => p.submission_status === 'DA_DUYET').length;
  const countOrdered = allPOs.filter(p => p.po_status === 'DA_TAO_PO' || p.po_status === 'DOI_TAC_XAC_NHAN' || p.po_status === 'DANG_THUC_HIEN').length;
  const countShipping = allPOs.filter(p => p.delivery_status === 'DANG_GIAO' || p.delivery_status === 'DOI_TAC_DA_GIAO').length;
  const countPendingReceipt = allPOs.filter(p => p.delivery_status === 'DOI_TAC_DA_GIAO' || p.delivery_status === 'GIAO_THIEU').length;
  const countCompleted = allPOs.filter(p => p.delivery_status === 'HOAN_TAT' || p.po_status === 'HOAN_TAT').length;
  const countOverdue = allPOs.filter(p => p.is_overdue === true || p.delivery_status === 'GIAO_THIEU').length;

  const totalValue = allPOs.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);

  // Tính thời gian xử lý trung bình
  let sumLifecycleHours = 0;
  let countCompletedLifecycles = 0;

  allPOs.forEach(p => {
    if (p.exported_at && (p.completed_at || p.delivery_status === 'HOAN_TAT')) {
      const end = p.completed_at ? new Date(p.completed_at) : new Date(p.created_at);
      const start = new Date(p.exported_at);
      sumLifecycleHours += (end - start) / (1000 * 60 * 60 * 24);
      countCompletedLifecycles++;
    }
  });

  const avgLifecycleDays = countCompletedLifecycles > 0 ? Math.round((sumLifecycleHours / countCompletedLifecycles) * 10) / 10 : 3.5;

  return {
    kpis: {
      total_pos: totalPOs,
      pending_approval: countPendingApproval,
      approved: countApproved,
      ordered: countOrdered,
      shipping: countShipping,
      pending_receipt: countPendingReceipt,
      completed: countCompleted,
      overdue: countOverdue,
      total_value: totalValue,
      avg_processing_days: avgLifecycleDays
    },
    recent_pos: allPOs.slice(0, 8)
  };
}
