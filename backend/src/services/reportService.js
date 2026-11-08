import { query } from '../config/database.js';

export async function getMasterPoReport() {
  const statusCounts = await query(`
    SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total_amount
    FROM purchase_orders
    WHERE deleted_at IS NULL
    GROUP BY status
  `);

  const summary = await query(`
    SELECT 
      COUNT(*) as total_pos,
      COALESCE(SUM(total_amount), 0) as grand_total_amount,
      COALESCE(SUM(total_quantity), 0) as grand_total_quantity,
      COALESCE(SUM(delivered_quantity), 0) as grand_delivered_quantity,
      COALESCE(SUM(received_quantity), 0) as grand_received_quantity
    FROM purchase_orders
    WHERE deleted_at IS NULL
  `);

  const payGroupStats = await query(`
    SELECT payment_group, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total_amount
    FROM purchase_orders
    WHERE deleted_at IS NULL
    GROUP BY payment_group
  `);

  return {
    summary: summary[0],
    statusCounts,
    payGroupStats
  };
}

export async function getUnitProcurementReport() {
  const unitStats = await query(`
    SELECT 
      d.id as department_id,
      d.name as department_name,
      d.code as department_code,
      d.type as department_type,
      d.region as department_region,
      COUNT(DISTINCT pia.po_id) as po_count,
      COUNT(pia.id) as allocation_lines_count,
      COALESCE(SUM(pia.allocated_quantity), 0) as total_allocated_qty,
      COALESCE(SUM(pia.delivered_quantity), 0) as total_delivered_qty,
      COALESCE(SUM(pia.received_quantity), 0) as total_received_qty,
      COALESCE(SUM(pia.allocated_quantity * poi.unit_price), 0) as total_allocated_value
    FROM departments d
    LEFT JOIN po_item_allocations pia ON pia.department_id = d.id
    LEFT JOIN purchase_order_items poi ON poi.id = pia.po_item_id
    WHERE d.deleted_at IS NULL
    GROUP BY d.id, d.name, d.code, d.type, d.region
    ORDER BY total_allocated_value DESC
  `);

  return unitStats;
}

export async function getSupplierPerformanceReport() {
  const suppliers = await query(`
    SELECT 
      s.id as supplier_id,
      s.name as supplier_name,
      s.code as supplier_code,
      s.contact_person,
      s.phone,
      COUNT(DISTINCT po.id) as total_orders,
      COALESCE(SUM(po.total_amount), 0) as total_order_value,
      COALESCE(SUM(po.total_quantity), 0) as total_ordered_qty,
      COALESCE(SUM(po.delivered_quantity), 0) as total_delivered_qty,
      (SELECT COUNT(*) FROM purchase_order_deliveries pod WHERE pod.supplier_id = s.id) as delivery_batches_count,
      (
        SELECT COUNT(*) 
        FROM receipt_confirmation_items rci 
        JOIN receipt_confirmations rc ON rc.id = rci.receipt_id
        JOIN purchase_orders po2 ON po2.id = rc.po_id
        WHERE po2.supplier_id = s.id AND (rci.quantity_damaged > 0 OR rci.quantity_missing > 0)
      ) as discrepancy_count
    FROM suppliers s
    LEFT JOIN purchase_orders po ON po.supplier_id = s.id AND po.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
    GROUP BY s.id, s.name, s.code, s.contact_person, s.phone
    ORDER BY total_order_value DESC
  `);

  return suppliers.map(s => {
    const totalOrdered = Number(s.total_ordered_qty || 0);
    const totalDelivered = Number(s.total_delivered_qty || 0);
    const discCount = Number(s.discrepancy_count || 0);

    return {
      ...s,
      fulfillment_rate: totalOrdered > 0 ? Math.min(100, Math.round((totalDelivered / totalOrdered) * 100)) : 0,
      discrepancy_rate: totalDelivered > 0 ? Math.round((discCount / totalDelivered) * 100) : 0
    };
  });
}
