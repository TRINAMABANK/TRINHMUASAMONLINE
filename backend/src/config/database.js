import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.resolve(__dirname, '../../data/pgdata');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

export async function initDatabase() {
  if (dbInstance) return dbInstance;

  console.log(`[PostgreSQL] Đang khởi tạo PostgreSQL bền vững tại: ${dbDir}`);
  dbInstance = new PGlite(dbDir);

  // Tạo toàn bộ 22 bảng theo thiết kế chuẩn
  await createSchemaTables(dbInstance);

  const res = await dbInstance.query('SELECT version();');
  console.log(`[PostgreSQL] Kết nối thành công! Phiên bản: ${res.rows[0].version}`);

  return dbInstance;
}

export function getDb() {
  if (!dbInstance) {
    throw new Error('Cơ sở dữ liệu PostgreSQL chưa được khởi tạo. Hãy gọi initDatabase() trước.');
  }
  return dbInstance;
}

export async function query(sql, params = []) {
  const db = getDb();
  const res = await db.query(sql, params);
  return res.rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// Hỗ trợ transaction cho các nghiệp vụ nhiều bước
export async function transaction(callback) {
  const db = getDb();
  await db.query('BEGIN');
  try {
    const result = await callback(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function createSchemaTables(db) {
  const ddl = `
    -- 1. Bảng cơ cấu đơn vị (departments)
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'CHI_NHANH',
      parent_id TEXT REFERENCES departments(id),
      region TEXT,
      address TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP WITH TIME ZONE
    );

    -- 2. Bảng nhà cung cấp (suppliers)
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      tax_code TEXT,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP WITH TIME ZONE
    );

    -- 3. Bảng người dùng (users)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      department_id TEXT REFERENCES departments(id),
      supplier_id TEXT REFERENCES suppliers(id),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP WITH TIME ZONE
    );

    -- 4. Bảng vai trò (roles)
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Bảng liên kết người dùng - vai trò (user_roles)
    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, role_id)
    );

    -- 6. Bảng liên kết phòng ban - người dùng (department_users)
    CREATE TABLE IF NOT EXISTS department_users (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_primary BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(department_id, user_id)
    );

    -- 7. Bảng đợt mua sắm (procurement_batches)
    CREATE TABLE IF NOT EXISTS procurement_batches (
      id TEXT PRIMARY KEY,
      batch_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      year INTEGER NOT NULL DEFAULT 2026,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 8. Bảng hồ sơ trình ký (procurement_requests)
    CREATE TABLE IF NOT EXISTS procurement_requests (
      id TEXT PRIMARY KEY,
      batch_id TEXT REFERENCES procurement_batches(id),
      request_number TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      submission_date TIMESTAMP WITH TIME ZONE,
      approved_date TIMESTAMP WITH TIME ZONE,
      total_amount NUMERIC(18, 2) DEFAULT 0,
      hoi_so_amount NUMERIC(18, 2) DEFAULT 0,
      don_vi_amount NUMERIC(18, 2) DEFAULT 0,
      total_items INTEGER DEFAULT 0,
      requester_id TEXT REFERENCES users(id),
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP WITH TIME ZONE
    );

    -- 9. Bảng các dòng hàng trong hồ sơ (procurement_request_items)
    CREATE TABLE IF NOT EXISTS procurement_request_items (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES procurement_requests(id) ON DELETE CASCADE,
      stt INTEGER NOT NULL,
      department_id TEXT REFERENCES departments(id),
      department_name TEXT NOT NULL,
      supplier_id TEXT REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      item_name TEXT NOT NULL,
      spec TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
      amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
      purpose TEXT,
      msp TEXT,
      payment_group TEXT DEFAULT 'CHUA_PHAN_LOAI',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 10. Bảng sự kiện phê duyệt (approval_events)
    CREATE TABLE IF NOT EXISTS approval_events (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES procurement_requests(id) ON DELETE CASCADE,
      actor_id TEXT REFERENCES users(id),
      actor_name TEXT NOT NULL,
      role TEXT NOT NULL,
      decision TEXT NOT NULL,
      comment TEXT,
      decided_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 11. Bảng Purchase Orders - PO theo từng NCC (purchase_orders)
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT UNIQUE NOT NULL,
      request_id TEXT REFERENCES procurement_requests(id),
      supplier_id TEXT NOT NULL REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expected_delivery_date TIMESTAMP WITH TIME ZONE,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      total_amount NUMERIC(18, 2) DEFAULT 0,
      total_quantity INTEGER DEFAULT 0,
      delivered_quantity INTEGER DEFAULT 0,
      received_quantity INTEGER DEFAULT 0,
      payment_group TEXT,
      idempotency_key TEXT UNIQUE,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP WITH TIME ZONE,
      UNIQUE(request_id, supplier_id)
    );

    -- 12. Bảng mặt hàng tổng hợp trong PO (purchase_order_items)
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY,
      po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      item_name TEXT NOT NULL,
      spec TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
      amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
      delivered_quantity INTEGER DEFAULT 0,
      received_quantity INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 13. Bảng liên kết dòng hàng gốc từ hồ sơ sang PO (po_source_items)
    CREATE TABLE IF NOT EXISTS po_source_items (
      id TEXT PRIMARY KEY,
      po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      po_item_id TEXT NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
      source_item_id TEXT NOT NULL REFERENCES procurement_request_items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL,
      amount NUMERIC(18, 2) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 14. Bảng phân bổ hàng hóa cho từng đơn vị (po_item_allocations)
    CREATE TABLE IF NOT EXISTS po_item_allocations (
      id TEXT PRIMARY KEY,
      po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      po_item_id TEXT NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
      department_id TEXT NOT NULL REFERENCES departments(id),
      department_name TEXT NOT NULL,
      allocated_quantity INTEGER NOT NULL DEFAULT 0,
      delivered_quantity INTEGER NOT NULL DEFAULT 0,
      received_quantity INTEGER NOT NULL DEFAULT 0,
      purpose TEXT,
      msp TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 15. Bảng các đợt giao hàng (purchase_order_deliveries)
    CREATE TABLE IF NOT EXISTS purchase_order_deliveries (
      id TEXT PRIMARY KEY,
      po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      delivery_code TEXT UNIQUE NOT NULL,
      supplier_id TEXT REFERENCES suppliers(id),
      delivery_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'DISPATCHED',
      carrier TEXT,
      tracking_number TEXT,
      note TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 16. Bảng chi tiết giao hàng theo mặt hàng / phân bổ (delivery_items)
    CREATE TABLE IF NOT EXISTS delivery_items (
      id TEXT PRIMARY KEY,
      delivery_id TEXT NOT NULL REFERENCES purchase_order_deliveries(id) ON DELETE CASCADE,
      po_item_id TEXT REFERENCES purchase_order_items(id),
      allocation_id TEXT REFERENCES po_item_allocations(id),
      quantity_delivered INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 17. Bảng xác nhận nhận hàng từ đơn vị (receipt_confirmations)
    CREATE TABLE IF NOT EXISTS receipt_confirmations (
      id TEXT PRIMARY KEY,
      receipt_code TEXT UNIQUE NOT NULL,
      po_id TEXT REFERENCES purchase_orders(id),
      delivery_id TEXT REFERENCES purchase_order_deliveries(id),
      department_id TEXT NOT NULL REFERENCES departments(id),
      received_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'RECEIVED',
      receiver_name TEXT NOT NULL,
      receiver_id TEXT REFERENCES users(id),
      condition_note TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 18. Bảng chi tiết xác nhận nhận hàng (receipt_confirmation_items)
    CREATE TABLE IF NOT EXISTS receipt_confirmation_items (
      id TEXT PRIMARY KEY,
      receipt_id TEXT NOT NULL REFERENCES receipt_confirmations(id) ON DELETE CASCADE,
      po_item_id TEXT REFERENCES purchase_order_items(id),
      allocation_id TEXT REFERENCES po_item_allocations(id),
      quantity_received INTEGER NOT NULL DEFAULT 0,
      quantity_damaged INTEGER DEFAULT 0,
      quantity_missing INTEGER DEFAULT 0,
      discrepancy_reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 19. Bảng sự kiện vòng đời mua sắm (lifecycle_events)
    CREATE TABLE IF NOT EXISTS lifecycle_events (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      actor_id TEXT REFERENCES users(id),
      actor_name TEXT,
      event_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      note TEXT,
      metadata JSONB
    );

    -- 20. Bảng chứng từ, tài liệu đính kèm (attachments)
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT,
      uploaded_by TEXT REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 21. Bảng nhật ký kiểm toán (audit_logs)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      user_name TEXT,
      user_role TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      old_values JSONB,
      new_values JSONB,
      ip_address TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 22. Bảng refresh tokens phiên đăng nhập (refresh_tokens)
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      revoked_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 23. Bảng thông báo hệ thống (notifications)
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      target_role TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'INFO',
      is_read BOOLEAN DEFAULT false,
      link TEXT,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Tạo các chỉ mục (Indexes) để tăng tốc độ truy vấn
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_dept ON users(department_id);
    CREATE INDEX IF NOT EXISTS idx_users_supplier ON users(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_po_req_num ON procurement_requests(request_number);
    CREATE INDEX IF NOT EXISTS idx_po_req_status ON procurement_requests(status);
    CREATE INDEX IF NOT EXISTS idx_req_items_req_id ON procurement_request_items(request_id);
    CREATE INDEX IF NOT EXISTS idx_req_items_dept ON procurement_request_items(department_id);
    CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);
    CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
    CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
    CREATE INDEX IF NOT EXISTS idx_alloc_po ON po_item_allocations(po_id);
    CREATE INDEX IF NOT EXISTS idx_alloc_dept ON po_item_allocations(department_id);
    CREATE INDEX IF NOT EXISTS idx_alloc_po_item ON po_item_allocations(po_item_id);
    CREATE INDEX IF NOT EXISTS idx_deliv_po ON purchase_order_deliveries(po_id);
    CREATE INDEX IF NOT EXISTS idx_deliv_items_deliv ON delivery_items(delivery_id);
    CREATE INDEX IF NOT EXISTS idx_deliv_items_alloc ON delivery_items(allocation_id);
    CREATE INDEX IF NOT EXISTS idx_receipt_po ON receipt_confirmations(po_id);
    CREATE INDEX IF NOT EXISTS idx_receipt_dept ON receipt_confirmations(department_id);
    CREATE INDEX IF NOT EXISTS idx_receipt_items_rec ON receipt_confirmation_items(receipt_id);
    CREATE INDEX IF NOT EXISTS idx_receipt_items_alloc ON receipt_confirmation_items(allocation_id);
    CREATE INDEX IF NOT EXISTS idx_lifecycle_entity ON lifecycle_events(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

    -- 23. Bảng vòng đời mua sắm (procurement_lifecycles)
    CREATE TABLE IF NOT EXISTS procurement_lifecycles (
      id TEXT PRIMARY KEY,
      po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      current_stage TEXT NOT NULL DEFAULT 'PHIEU_TRINH_XUAT',
      is_overdue BOOLEAN DEFAULT FALSE,
      sla_target_hours INTEGER DEFAULT 48,
      exported_at TIMESTAMP WITH TIME ZONE,
      approved_at TIMESTAMP WITH TIME ZONE,
      ordered_at TIMESTAMP WITH TIME ZONE,
      vendor_confirmed_at TIMESTAMP WITH TIME ZONE,
      shipped_at TIMESTAMP WITH TIME ZONE,
      delivered_at TIMESTAMP WITH TIME ZONE,
      received_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 24. Bảng các đợt thanh toán (payment_batches)
    CREATE TABLE IF NOT EXISTS payment_batches (
      id TEXT PRIMARY KEY,
      batch_code TEXT NOT NULL,
      po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      pay_type TEXT NOT NULL,
      item_count INTEGER DEFAULT 0,
      total_amount NUMERIC(18, 2) DEFAULT 0,
      accepted_by TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 25. Bảng lịch sử phê duyệt (approval_histories)
    CREATE TABLE IF NOT EXISTS approval_histories (
      id TEXT PRIMARY KEY,
      po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_id TEXT,
      actor_name TEXT,
      actor_role TEXT,
      comment TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Tự động bổ sung các cột tương thích vào bảng dữ liệu
    ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS stt INTEGER DEFAULT 1;
    ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS request_date TEXT;
    ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS unit_name TEXT;
    ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS supplier_name TEXT;
    ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS qty INTEGER DEFAULT 1;
    ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS purpose TEXT;
    ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS msp TEXT;
    ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS pay_group TEXT;
    ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS received_qty INTEGER DEFAULT 0;

    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS requester_name TEXT;
    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS source_file TEXT;
    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS submission_status TEXT DEFAULT 'KHOI_TAO';
    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_status TEXT DEFAULT 'DA_TAO_PO';
    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'CHUA_GIAO';
    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS total_qty INTEGER DEFAULT 0;
    ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_by_id TEXT;

    ALTER TABLE lifecycle_events ADD COLUMN IF NOT EXISTS po_id TEXT;
    ALTER TABLE lifecycle_events ADD COLUMN IF NOT EXISTS object_type TEXT;
    ALTER TABLE lifecycle_events ADD COLUMN IF NOT EXISTS object_id TEXT;
    ALTER TABLE lifecycle_events ADD COLUMN IF NOT EXISTS previous_status TEXT;
    ALTER TABLE lifecycle_events ADD COLUMN IF NOT EXISTS actor_role TEXT;
    ALTER TABLE lifecycle_events ADD COLUMN IF NOT EXISTS event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
  `;

  await db.exec(ddl);
}
