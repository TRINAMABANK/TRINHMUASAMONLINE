import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { initDatabase, query, getDb } from '../src/config/database.js';

// Hàm sinh UUID v4 bằng Node crypto
function makeId() {
  return crypto.randomUUID();
}

export async function runSeed() {
  console.log('🚀 [SEED] Đang khởi chạy nạp dữ liệu kiểm thử hệ thống Master PO...');
  await initDatabase();
  const db = getDb();

  // 1. Xóa dữ liệu cũ theo thứ tự ràng buộc
  console.log('🧹 Xóa dữ liệu cũ...');
  const tables = [
    'receipt_confirmation_items', 'receipt_confirmations',
    'delivery_items', 'purchase_order_deliveries',
    'po_item_allocations', 'po_source_items', 'purchase_order_items', 'purchase_orders',
    'approval_events', 'procurement_request_items', 'procurement_requests', 'procurement_batches',
    'attachments', 'audit_logs', 'refresh_tokens', 'lifecycle_events',
    'department_users', 'user_roles', 'users', 'roles', 'departments', 'suppliers'
  ];

  for (const table of tables) {
    try {
      await db.query(`DELETE FROM ${table};`);
    } catch (e) {
      // Bỏ qua lỗi nếu bảng chưa có
    }
  }

  // 2. Nạp Bảng Roles
  console.log('👑 Tạo bảng roles...');
  const roles = [
    { id: makeId(), code: 'ADMIN', name: 'Quản trị hệ thống', description: 'Toàn quyền cấu hình và quản trị' },
    { id: makeId(), code: 'QTTS', name: 'Quản lý Tài sản / BP Mua sắm', description: 'Tạo PO, phân bổ, quản lý hồ sơ và master PO' },
    { id: makeId(), code: 'APPROVER', name: 'Lãnh đạo Phê duyệt', description: 'Phê duyệt hồ sơ trình ký và đề xuất mua sắm' },
    { id: makeId(), code: 'DON_VI', name: 'Đơn vị Nhận hàng', description: 'Chi nhánh/PGD/OneBank tra cứu và xác nhận nhận hàng' },
    { id: makeId(), code: 'SUPPLIER', name: 'Nhà cung cấp', description: 'Xác nhận đơn hàng và báo cáo tiến độ giao hàng' },
    { id: makeId(), code: 'VIEWER', name: 'Người xem', description: 'Xem thông tin tổng hợp' }
  ];

  const roleMap = {};
  for (const r of roles) {
    await db.query(
      `INSERT INTO roles (id, code, name, description) VALUES ($1, $2, $3, $4);`,
      [r.id, r.code, r.name, r.description]
    );
    roleMap[r.code] = r.id;
  }

  // 3. Nạp 5 Đơn vị (Departments) theo yêu cầu Section N
  console.log('🏢 Tạo 5 đơn vị (Chi nhánh, PGD, OneBank)...');
  const depts = [
    { id: makeId(), code: 'CN_HANOI', name: 'Chi Nhánh Hà Nội', type: 'CHI_NHANH', region: 'MIEN_BAC' },
    { id: makeId(), code: 'CN_THANHHOA', name: 'Chi nhánh Thanh Hóa', type: 'CHI_NHANH', region: 'MIEN_TRUNG' },
    { id: makeId(), code: 'CN_BACHANOI', name: 'Chi Nhánh Bắc Hà Nội', type: 'CHI_NHANH', region: 'MIEN_BAC' },
    { id: makeId(), code: 'OB_BINHMINH', name: 'OneBank Bình Minh', type: 'ONEBANK', region: 'MIEN_BAC' },
    { id: makeId(), code: 'OB_BATRIEU', name: 'OneBank Bà Triệu', type: 'ONEBANK', region: 'MIEN_BAC' },
    { id: makeId(), code: 'HOI_SO', name: 'Hội sở Ngân hàng', type: 'HOI_SO', region: 'MIEN_NAM' }
  ];

  const deptMap = {};
  for (const d of depts) {
    await db.query(
      `INSERT INTO departments (id, code, name, type, region) VALUES ($1, $2, $3, $4, $5);`,
      [d.id, d.code, d.name, d.type, d.region]
    );
    deptMap[d.code] = d;
  }

  // 4. Nạp 3 Nhà cung cấp (Suppliers) theo Section N
  console.log('🏭 Tạo 3 nhà cung cấp...');
  const suppliers = [
    { id: makeId(), code: 'FTI', name: 'CTY TNHH TM DV TIN HỌC FTI', taxCode: '0303848123', email: 'ncc_fti@supplier.com', phone: '02873002222', contactPerson: 'Nguyễn Văn FTI' },
    { id: makeId(), code: 'SIEU_THANH', name: 'CTY CỔ PHẦN THIẾT BỊ VĂN PHÒNG SIÊU THANH', taxCode: '0301449876', email: 'ncc_sieuthanh@supplier.com', phone: '02838356789', contactPerson: 'Trần Văn Siêu Thanh' },
    { id: makeId(), code: 'HANG_TIN', name: 'CTY TNHH TM DV HÀNG TIN', taxCode: '0312567890', email: 'ncc_hangtin@supplier.com', phone: '02839485761', contactPerson: 'Lê Văn Hàng Tin' }
  ];

  const supplierMap = {};
  for (const s of suppliers) {
    await db.query(
      `INSERT INTO suppliers (id, code, name, tax_code, email, phone, contact_person) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [s.id, s.code, s.name, s.taxCode, s.email, s.phone, s.contactPerson]
    );
    supplierMap[s.code] = s;
  }

  // 5. Nạp Người dùng (Users) với mật khẩu chuẩn NamABank@2026
  console.log('👤 Tạo người dùng các vai trò...');
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('NamABank@2026', salt);

  const users = [
    { id: makeId(), email: 'admin@namabank.com.vn', fullName: 'Quản trị viên Hệ thống', roleCode: 'ADMIN' },
    { id: makeId(), email: 'qtts@namabank.com.vn', fullName: 'Chuyên viên Quản lý Tài sản', roleCode: 'QTTS', deptCode: 'HOI_SO' },
    { id: makeId(), email: 'approver@namabank.com.vn', fullName: 'Trưởng Ban Phê duyệt Mua sắm', roleCode: 'APPROVER', deptCode: 'HOI_SO' },
    { id: makeId(), email: 'cnhanoi@namabank.com.vn', fullName: 'Kế toán CN Hà Nội', roleCode: 'DON_VI', deptCode: 'CN_HANOI' },
    { id: makeId(), email: 'cnthanhhoa@namabank.com.vn', fullName: 'Kế toán CN Thanh Hóa', roleCode: 'DON_VI', deptCode: 'CN_THANHHOA' },
    { id: makeId(), email: 'cnbachanoi@namabank.com.vn', fullName: 'Kế toán CN Bắc Hà Nội', roleCode: 'DON_VI', deptCode: 'CN_BACHANOI' },
    { id: makeId(), email: 'ncc_fti@supplier.com', fullName: 'Đại diện FTI Tech', roleCode: 'SUPPLIER', supplierCode: 'FTI' },
    { id: makeId(), email: 'ncc_sieuthanh@supplier.com', fullName: 'Đại diện Siêu Thanh', roleCode: 'SUPPLIER', supplierCode: 'SIEU_THANH' },
    { id: makeId(), email: 'ncc_hangtin@supplier.com', fullName: 'Đại diện Hàng Tin', roleCode: 'SUPPLIER', supplierCode: 'HANG_TIN' }
  ];

  const userMap = {};
  for (const u of users) {
    const deptId = u.deptCode ? deptMap[u.deptCode].id : null;
    const suppId = u.supplierCode ? supplierMap[u.supplierCode].id : null;

    await db.query(
      `INSERT INTO users (id, email, password_hash, full_name, department_id, supplier_id) VALUES ($1, $2, $3, $4, $5, $6);`,
      [u.id, u.email, passwordHash, u.fullName, deptId, suppId]
    );

    // Gán role
    await db.query(
      `INSERT INTO user_roles (id, user_id, role_id) VALUES ($1, $2, $3);`,
      [makeId(), u.id, roleMap[u.roleCode]]
    );

    // Gán department_users nếu có
    if (deptId) {
      await db.query(
        `INSERT INTO department_users (id, department_id, user_id, is_primary) VALUES ($1, $2, $3, $4);`,
        [makeId(), deptId, u.id, true]
      );
    }

    userMap[u.email] = u;
  }

  // 6. Nạp 1 Đợt mua sắm (Procurement Batch: PB-2026-Q1)
  console.log('📦 Tạo Đợt mua sắm PB-2026-Q1...');
  const batchId = makeId();
  await db.query(
    `INSERT INTO procurement_batches (id, batch_code, title, description, year, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7);`,
    [batchId, 'PB-2026-Q1', 'Đợt mua sắm Trang thiết bị CNTT & Văn phòng Quý 1/2026', 'Trang bị mới và thay thế thiết bị cho các Đơn vị KV Miền Bắc & Trung', 2026, 'IN_PROGRESS', userMap['qtts@namabank.com.vn'].id]
  );

  // 7. Nạp 1 Hồ sơ trình ký (Procurement Request: PYC-2026-00048)
  console.log('📑 Tạo Hồ sơ trình ký PYC-2026-00048...');
  const reqId = makeId();
  await db.query(
    `INSERT INTO procurement_requests (
      id, batch_id, request_number, title, status, submission_date, approved_date,
      total_amount, hoi_so_amount, don_vi_amount, total_items, requester_id, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
    [
      reqId, batchId, 'PYC-2026-00048',
      'Tờ trình mua sắm bổ sung máy tính, màn hình, máy in và máy photocopy Quý 1/2026',
      'APPROVED',
      new Date('2026-01-15T09:00:00Z'),
      new Date('2026-01-18T14:30:00Z'),
      515173000.00, // Khớp với UI: 515.173.000 đ
      69057000.00,  // Hội sở thanh toán: 69.057.000 đ
      446116000.00, // Đơn vị thanh toán: 446.116.000 đ
      45,
      userMap['qtts@namabank.com.vn'].id,
      userMap['qtts@namabank.com.vn'].id
    ]
  );

  // Ghi nhận sự kiện phê duyệt
  await db.query(
    `INSERT INTO approval_events (id, request_id, actor_id, actor_name, role, decision, comment, decided_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
    [
      makeId(), reqId, userMap['approver@namabank.com.vn'].id,
      userMap['approver@namabank.com.vn'].fullName, 'APPROVER',
      'APPROVE', 'Đồng ý chủ trương mua sắm theo đề xuất của QTTS.',
      new Date('2026-01-18T14:30:00Z')
    ]
  );

  // 8. Nạp các dòng hàng chi tiết trong hồ sơ (procurement_request_items)
  // Có mặt hàng phân bổ đa đơn vị theo yêu cầu Section E & N
  console.log('📋 Tạo các dòng hàng trong hồ sơ...');
  const itemsData = [
    // FTI Items
    {
      stt: 1, deptCode: 'CN_HANOI', suppCode: 'FTI',
      itemName: 'Máy in laser HP LaserJet Pro M402DN',
      spec: 'Laser trắng đen / 38 trang/phút / Đảo mặt tự động / Network',
      qty: 2, unitPrice: 7500000, purpose: 'Trang bị thay thế máy in cũ hư hỏng',
      msp: '801BNPT2026042', payGroup: 'HOI_SO'
    },
    {
      stt: 2, deptCode: 'OB_BINHMINH', suppCode: 'FTI',
      itemName: 'Máy in Brother HL-L6210DW',
      spec: 'Laser tốc độ cao / Khay giấy 520 tờ / Duplex / Wifi',
      qty: 3, unitPrice: 18019000, purpose: 'Trang bị cho OneBank Bình Minh mới thành lập',
      msp: '801FN02181030041', payGroup: 'HOI_SO'
    },
    {
      stt: 3, deptCode: 'CN_THANHHOA', suppCode: 'FTI',
      itemName: 'Bộ máy tính bàn PC Lenovo ThinkCentre neo 50s Gen 6 U3-205',
      spec: 'Core i5-13400 / 16GB RAM / 512GB SSD / KB+M / No OS / 3Y',
      qty: 4, unitPrice: 15450000, purpose: 'Trang bị cho chuyên viên KHDN và Ngân quỹ',
      msp: '801PC2026011', payGroup: 'DON_VI'
    },
    {
      stt: 4, deptCode: 'CN_BACHANOI', suppCode: 'FTI',
      itemName: 'Bộ máy tính bàn PC Lenovo ThinkCentre neo 50s Gen 6 U3-205',
      spec: 'Core i5-13400 / 16GB RAM / 512GB SSD / KB+M / No OS / 3Y',
      qty: 6, unitPrice: 15450000, purpose: 'Trang bị cho PGD Thái Hà & PGD Đống Đa',
      msp: '801PC2026012', payGroup: 'DON_VI'
    },
    {
      stt: 5, deptCode: 'CN_THANHHOA', suppCode: 'FTI',
      itemName: 'Màn hình máy vi tính LCD Lenovo L24i-4A 23.8 inch IPS 100Hz',
      spec: '23.8 inch / Full HD 1920x1080 / IPS / 100Hz / HDMI + VGA',
      qty: 4, unitPrice: 2850000, purpose: 'Đồng bộ cùng case PC Lenovo',
      msp: '801LCD2026021', payGroup: 'DON_VI'
    },
    {
      stt: 6, deptCode: 'CN_BACHANOI', suppCode: 'FTI',
      itemName: 'Màn hình máy vi tính LCD Lenovo L24i-4A 23.8 inch IPS 100Hz',
      spec: '23.8 inch / Full HD 1920x1080 / IPS / 100Hz / HDMI + VGA',
      qty: 6, unitPrice: 2850000, purpose: 'Đồng bộ cùng case PC Lenovo',
      msp: '801LCD2026022', payGroup: 'DON_VI'
    },
    // SIEU_THANH Items
    {
      stt: 7, deptCode: 'CN_THANHHOA', suppCode: 'SIEU_THANH',
      itemName: 'Máy photocopy đa chức năng Ricoh IM 2702',
      spec: 'A3/A4 / Đa chức năng In - Copy - Scan màu / Khay đôi / ARDF',
      qty: 1, unitPrice: 38500000, purpose: 'Trang bị máy photo chính cho chi nhánh',
      msp: '801PCO2026001', payGroup: 'DON_VI'
    },
    {
      stt: 8, deptCode: 'CN_HANOI', suppCode: 'SIEU_THANH',
      itemName: 'Máy photocopy đa chức năng Ricoh IM 3500',
      spec: 'A3/A4 / Tốc độ 35 trang/phút / Network / Duplex',
      qty: 2, unitPrice: 52000000, purpose: 'Trang bị văn phòng CN Hà Nội',
      msp: '801PCO2026002', payGroup: 'DON_VI'
    },
    // HANG_TIN Items
    {
      stt: 9, deptCode: 'OB_BINHMINH', suppCode: 'HANG_TIN',
      itemName: 'Máy đếm tiền phát hiện tiền giả Glory GFS-120',
      spec: 'Phát hiện tiền giả Polymer siêu chuẩn / Tốc độ 1000 tờ/phút',
      qty: 2, unitPrice: 19500000, purpose: 'Trang bị quầy giao dịch OneBank Bình Minh',
      msp: '801MDT2026001', payGroup: 'DON_VI'
    },
    {
      stt: 10, deptCode: 'OB_BATRIEU', suppCode: 'HANG_TIN',
      itemName: 'Máy đếm tiền phát hiện tiền giả Glory GFS-120',
      spec: 'Phát hiện tiền giả Polymer siêu chuẩn / Tốc độ 1000 tờ/phút',
      qty: 2, unitPrice: 19500000, purpose: 'Trang bị quầy giao dịch OneBank Bà Triệu',
      msp: '801MDT2026002', payGroup: 'DON_VI'
    }
  ];

  const reqItemRecords = [];
  for (const it of itemsData) {
    const itId = makeId();
    const dept = deptMap[it.deptCode];
    const supp = supplierMap[it.suppCode];
    const amount = it.qty * it.unitPrice;

    await db.query(
      `INSERT INTO procurement_request_items (
        id, request_id, stt, department_id, department_name,
        supplier_id, supplier_name, item_name, spec, quantity,
        unit_price, amount, purpose, msp, payment_group
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);`,
      [
        itId, reqId, it.stt, dept.id, dept.name,
        supp.id, supp.name, it.itemName, it.spec, it.qty,
        it.unitPrice, amount, it.purpose, it.msp, it.payGroup
      ]
    );

    reqItemRecords.push({ ...it, id: itId, deptId: dept.id, deptName: dept.name, suppId: supp.id, suppName: supp.name, amount });
  }

  // 9. Sinh 3 PO theo 3 Nhà Cung Cấp (Section D & N)
  console.log('🛒 Sinh 3 PO cho 3 Nhà cung cấp (FTI, SIEU_THANH, HANG_TIN)...');

  // PO 1: FTI
  const ftiItems = reqItemRecords.filter(x => x.suppCode === 'FTI');
  const ftiTotalAmount = ftiItems.reduce((sum, x) => sum + x.amount, 0);
  const ftiTotalQty = ftiItems.reduce((sum, x) => sum + x.qty, 0);
  const poFtiId = makeId();
  const poFtiNumber = 'PO-2026-00048-FTI';

  await db.query(
    `INSERT INTO purchase_orders (
      id, po_number, request_id, supplier_id, supplier_name, order_date,
      expected_delivery_date, status, total_amount, total_quantity,
      payment_group, idempotency_key, note, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
    [
      poFtiId, poFtiNumber, reqId, supplierMap['FTI'].id, supplierMap['FTI'].name,
      new Date('2026-01-20T08:30:00Z'), new Date('2026-02-10T17:00:00Z'),
      'PARTIALLY_DELIVERED', ftiTotalAmount, ftiTotalQty,
      'HON_HOP', `IDEMP_${reqId}_${supplierMap['FTI'].id}`,
      'PO đặt hàng máy tính và máy in cho KV Miền Bắc', userMap['qtts@namabank.com.vn'].id
    ]
  );

  // PO 2: SIEU_THANH
  const stItems = reqItemRecords.filter(x => x.suppCode === 'SIEU_THANH');
  const stTotalAmount = stItems.reduce((sum, x) => sum + x.amount, 0);
  const stTotalQty = stItems.reduce((sum, x) => sum + x.qty, 0);
  const poStId = makeId();
  const poStNumber = 'PO-2026-00048-SIEU_THANH';

  await db.query(
    `INSERT INTO purchase_orders (
      id, po_number, request_id, supplier_id, supplier_name, order_date,
      expected_delivery_date, status, total_amount, total_quantity,
      payment_group, idempotency_key, note, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
    [
      poStId, poStNumber, reqId, supplierMap['SIEU_THANH'].id, supplierMap['SIEU_THANH'].name,
      new Date('2026-01-20T08:30:00Z'), new Date('2026-02-15T17:00:00Z'),
      'SUPPLIER_CONFIRMED', stTotalAmount, stTotalQty,
      'DON_VI', `IDEMP_${reqId}_${supplierMap['SIEU_THANH'].id}`,
      'PO máy photocopy Ricoh', userMap['qtts@namabank.com.vn'].id
    ]
  );

  // PO 3: HANG_TIN
  const htItems = reqItemRecords.filter(x => x.suppCode === 'HANG_TIN');
  const htTotalAmount = htItems.reduce((sum, x) => sum + x.amount, 0);
  const htTotalQty = htItems.reduce((sum, x) => sum + x.qty, 0);
  const poHtId = makeId();
  const poHtNumber = 'PO-2026-00048-HANG_TIN';

  await db.query(
    `INSERT INTO purchase_orders (
      id, po_number, request_id, supplier_id, supplier_name, order_date,
      expected_delivery_date, status, total_amount, total_quantity,
      payment_group, idempotency_key, note, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
    [
      poHtId, poHtNumber, reqId, supplierMap['HANG_TIN'].id, supplierMap['HANG_TIN'].name,
      new Date('2026-01-20T08:30:00Z'), new Date('2026-02-05T17:00:00Z'),
      'ISSUED', htTotalAmount, htTotalQty,
      'DON_VI', `IDEMP_${reqId}_${supplierMap['HANG_TIN'].id}`,
      'PO máy đếm tiền Glory cho OneBank', userMap['qtts@namabank.com.vn'].id
    ]
  );

  // 10. Tạo PO Items và Phân bổ (Allocations) cho từng PO
  console.log('📌 Tạo mặt hàng PO và bảng phân bổ po_item_allocations...');

  // Xử lý gom nhóm items theo tên hàng cho PO FTI
  // Gom dòng máy tính: 4 Thanh Hóa + 6 Bắc Hà Nội = 10 cái máy tính (Đúng ví dụ nghiệp vụ Section E!)
  const poFtiItemPCId = makeId();
  await db.query(
    `INSERT INTO purchase_order_items (id, po_id, item_name, spec, quantity, unit_price, amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7);`,
    [poFtiItemPCId, poFtiId, 'Bộ máy tính bàn PC Lenovo ThinkCentre neo 50s Gen 6 U3-205', 'Core i5-13400 / 16GB RAM / 512GB SSD / KB+M / No OS / 3Y', 10, 15450000, 154500000]
  );

  // Phân bổ 10 máy tính này cho:
  // - CN Thanh Hóa: 4 máy
  // - CN Bắc Hà Nội: 6 máy
  const allocPCThanhHoaId = makeId();
  await db.query(
    `INSERT INTO po_item_allocations (id, po_id, po_item_id, department_id, department_name, allocated_quantity, delivered_quantity, received_quantity, purpose, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
    [allocPCThanhHoaId, poFtiId, poFtiItemPCId, deptMap['CN_THANHHOA'].id, deptMap['CN_THANHHOA'].name, 4, 4, 3, 'Trang bị cho chuyên viên KHDN và Ngân quỹ', 'PARTIALLY_RECEIVED']
  );

  const allocPCBacHaNoiId = makeId();
  await db.query(
    `INSERT INTO po_item_allocations (id, po_id, po_item_id, department_id, department_name, allocated_quantity, delivered_quantity, received_quantity, purpose, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
    [allocPCBacHaNoiId, poFtiId, poFtiItemPCId, deptMap['CN_BACHANOI'].id, deptMap['CN_BACHANOI'].name, 6, 0, 0, 'Trang bị cho PGD Thái Hà & PGD Đống Đa', 'PENDING']
  );

  // Gom màn hình LCD Lenovo: 10 cái (4 Thanh Hóa + 6 Bắc Hà Nội)
  const poFtiItemLCDId = makeId();
  await db.query(
    `INSERT INTO purchase_order_items (id, po_id, item_name, spec, quantity, unit_price, amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7);`,
    [poFtiItemLCDId, poFtiId, 'Màn hình máy vi tính LCD Lenovo L24i-4A 23.8 inch IPS 100Hz', '23.8 inch / Full HD 1920x1080 / IPS / 100Hz / HDMI + VGA', 10, 2850000, 28500000]
  );
  const allocLCDThanhHoaId = makeId();
  await db.query(
    `INSERT INTO po_item_allocations (id, po_id, po_item_id, department_id, department_name, allocated_quantity, delivered_quantity, received_quantity, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
    [allocLCDThanhHoaId, poFtiId, poFtiItemLCDId, deptMap['CN_THANHHOA'].id, deptMap['CN_THANHHOA'].name, 4, 4, 4, 'COMPLETED']
  );
  const allocLCDBacHaNoiId = makeId();
  await db.query(
    `INSERT INTO po_item_allocations (id, po_id, po_item_id, department_id, department_name, allocated_quantity, delivered_quantity, received_quantity, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
    [allocLCDBacHaNoiId, poFtiId, poFtiItemLCDId, deptMap['CN_BACHANOI'].id, deptMap['CN_BACHANOI'].name, 6, 0, 0, 'PENDING']
  );

  // Máy in HP: 2 cái cho CN Hà Nội
  const poFtiItemHPId = makeId();
  await db.query(
    `INSERT INTO purchase_order_items (id, po_id, item_name, spec, quantity, unit_price, amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7);`,
    [poFtiItemHPId, poFtiId, 'Máy in laser HP LaserJet Pro M402DN', 'Laser trắng đen / 38 trang/phút', 2, 7500000, 15000000]
  );
  const allocHPId = makeId();
  await db.query(
    `INSERT INTO po_item_allocations (id, po_id, po_item_id, department_id, department_name, allocated_quantity, delivered_quantity, received_quantity, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
    [allocHPId, poFtiId, poFtiItemHPId, deptMap['CN_HANOI'].id, deptMap['CN_HANOI'].name, 2, 2, 2, 'COMPLETED']
  );

  // Máy in Brother: 3 cái cho OneBank Bình Minh
  const poFtiItemBrotherId = makeId();
  await db.query(
    `INSERT INTO purchase_order_items (id, po_id, item_name, spec, quantity, unit_price, amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7);`,
    [poFtiItemBrotherId, poFtiId, 'Máy in Brother HL-L6210DW', 'Laser tốc độ cao / Khay giấy 520 tờ', 3, 18019000, 54057000]
  );
  const allocBrotherId = makeId();
  await db.query(
    `INSERT INTO po_item_allocations (id, po_id, po_item_id, department_id, department_name, allocated_quantity, delivered_quantity, received_quantity, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
    [allocBrotherId, poFtiId, poFtiItemBrotherId, deptMap['OB_BINHMINH'].id, deptMap['OB_BINHMINH'].name, 3, 0, 0, 'PENDING']
  );

  // PO Siêu Thanh Items & Allocations
  for (const stItem of stItems) {
    const pItemId = makeId();
    await db.query(
      `INSERT INTO purchase_order_items (id, po_id, item_name, spec, quantity, unit_price, amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [pItemId, poStId, stItem.itemName, stItem.spec, stItem.qty, stItem.unitPrice, stItem.amount]
    );
    await db.query(
      `INSERT INTO po_item_allocations (id, po_id, po_item_id, department_id, department_name, allocated_quantity, purpose, msp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [makeId(), poStId, pItemId, stItem.deptId, stItem.deptName, stItem.qty, stItem.purpose, stItem.msp]
    );
  }

  // PO Hàng Tin Items & Allocations
  for (const htItem of htItems) {
    const pItemId = makeId();
    await db.query(
      `INSERT INTO purchase_order_items (id, po_id, item_name, spec, quantity, unit_price, amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [pItemId, poHtId, htItem.itemName, htItem.spec, htItem.qty, htItem.unitPrice, htItem.amount]
    );
    await db.query(
      `INSERT INTO po_item_allocations (id, po_id, po_item_id, department_id, department_name, allocated_quantity, purpose, msp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [makeId(), poHtId, pItemId, htItem.deptId, htItem.deptName, htItem.qty, htItem.purpose, htItem.msp]
    );
  }

  // 11. Tạo 2 Đợt Giao Hàng cho PO FTI (Section N: Giao hàng 2 đợt)
  console.log('🚚 Tạo 2 đợt giao hàng cho FTI...');

  // Đợt 1: Giao máy in cho Hà Nội (2 cái) + Giao đợt đầu PC (2 cái) & LCD (4 cái) cho Thanh Hóa
  const deliv1Id = makeId();
  await db.query(
    `INSERT INTO purchase_order_deliveries (
      id, po_id, delivery_code, supplier_id, delivery_date, status, carrier, tracking_number, note
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
    [
      deliv1Id, poFtiId, 'DEL-2026-FTI-001', supplierMap['FTI'].id,
      new Date('2026-01-25T10:00:00Z'), 'CONFIRMED',
      'Viettel Post', 'VTP-883921092', 'Đợt 1 giao thiết bị cho CN Hà Nội và CN Thanh Hóa'
    ]
  );

  // Chi tiết giao đợt 1:
  // - 2 Máy in HP cho Hà Nội
  await db.query(
    `INSERT INTO delivery_items (id, delivery_id, po_item_id, allocation_id, quantity_delivered, note)
     VALUES ($1, $2, $3, $4, $5, $6);`,
    [makeId(), deliv1Id, poFtiItemHPId, allocHPId, 2, 'Giao đủ 2 máy in HP']
  );
  // - 4 Màn hình LCD cho Thanh Hóa
  await db.query(
    `INSERT INTO delivery_items (id, delivery_id, po_item_id, allocation_id, quantity_delivered, note)
     VALUES ($1, $2, $3, $4, $5, $6);`,
    [makeId(), deliv1Id, poFtiItemLCDId, allocLCDThanhHoaId, 4, 'Giao 4 màn hình LCD']
  );
  // - 2 PC cho Thanh Hóa (Đợt đầu giao 2 máy trước)
  await db.query(
    `INSERT INTO delivery_items (id, delivery_id, po_item_id, allocation_id, quantity_delivered, note)
     VALUES ($1, $2, $3, $4, $5, $6);`,
    [makeId(), deliv1Id, poFtiItemPCId, allocPCThanhHoaId, 2, 'Giao 2 bộ PC Lenovo đợt 1']
  );

  // Đợt 2: Giao bổ sung 2 PC cho Thanh Hóa
  const deliv2Id = makeId();
  await db.query(
    `INSERT INTO purchase_order_deliveries (
      id, po_id, delivery_code, supplier_id, delivery_date, status, carrier, tracking_number, note
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
    [
      deliv2Id, poFtiId, 'DEL-2026-FTI-002', supplierMap['FTI'].id,
      new Date('2026-02-02T14:00:00Z'), 'DELIVERED',
      'Kerry Express', 'KRY-992014881', 'Đợt 2 giao bổ sung PC cho CN Thanh Hóa'
    ]
  );
  await db.query(
    `INSERT INTO delivery_items (id, delivery_id, po_item_id, allocation_id, quantity_delivered, note)
     VALUES ($1, $2, $3, $4, $5, $6);`,
    [makeId(), deliv2Id, poFtiItemPCId, allocPCThanhHoaId, 2, 'Giao bổ sung 2 bộ PC Lenovo']
  );

  // 12. Tạo Xác nhận nhận hàng (Section N: Nhận thiếu rồi nhận bổ sung)
  console.log('📝 Tạo biên bản xác nhận nhận hàng: Nhận thiếu đợt 1, nhận bổ sung đợt 2...');

  // Biên bản 1: CN Hà Nội nhận đủ máy in HP
  const rec1Id = makeId();
  await db.query(
    `INSERT INTO receipt_confirmations (
      id, receipt_code, po_id, delivery_id, department_id, received_date, status, receiver_name, condition_note
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
    [
      rec1Id, 'REC-HNI-2026-001', poFtiId, deliv1Id, deptMap['CN_HANOI'].id,
      new Date('2026-01-26T09:30:00Z'), 'RECEIVED', 'Nguyễn Thị Hoa - KT Chi nhánh',
      'Hàng mới 100%, nguyên đai nguyên kiện, chạy thử nghiệm thu tốt.'
    ]
  );
  await db.query(
    `INSERT INTO receipt_confirmation_items (id, receipt_id, po_item_id, allocation_id, quantity_received, quantity_damaged, quantity_missing)
     VALUES ($1, $2, $3, $4, $5, $6, $7);`,
    [makeId(), rec1Id, poFtiItemHPId, allocHPId, 2, 0, 0]
  );

  // Biên bản 2: CN Thanh Hóa nhận đợt 1 (Trong 2 PC giao thì 1 PC bị móp thùng, nhận 1 PC, báo thiếu/hư hại 1 PC)
  const rec2Id = makeId();
  await db.query(
    `INSERT INTO receipt_confirmations (
      id, receipt_code, po_id, delivery_id, department_id, received_date, status, receiver_name, condition_note
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
    [
      rec2Id, 'REC-THH-2026-001', poFtiId, deliv1Id, deptMap['CN_THANHHOA'].id,
      new Date('2026-01-27T11:00:00Z'), 'DISCREPANCY', 'Lê Hữu Nam - CNTT Chi nhánh',
      'Nhận 4 LCD tốt. Về PC: nhận 1 thùng nguyên, 1 thùng bị rách móp từ chối nhận, yêu cầu NCC đổi mới.'
    ]
  );
  await db.query(
    `INSERT INTO receipt_confirmation_items (id, receipt_id, po_item_id, allocation_id, quantity_received, quantity_damaged, quantity_missing, discrepancy_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
    [makeId(), rec2Id, poFtiItemLCDId, allocLCDThanhHoaId, 4, 0, 0, null]
  );
  await db.query(
    `INSERT INTO receipt_confirmation_items (id, receipt_id, po_item_id, allocation_id, quantity_received, quantity_damaged, quantity_missing, discrepancy_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
    [makeId(), rec2Id, poFtiItemPCId, allocPCThanhHoaId, 1, 1, 0, 'Thùng hàng rách móp có dấu hiệu rơi vỡ trong quá trình vận chuyển']
  );

  // Biên bản 3: CN Thanh Hóa nhận bổ sung đợt 2 (FTI đổi máy mới và giao bổ sung)
  const rec3Id = makeId();
  await db.query(
    `INSERT INTO receipt_confirmations (
      id, receipt_code, po_id, delivery_id, department_id, received_date, status, receiver_name, condition_note
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
    [
      rec3Id, 'REC-THH-2026-002', poFtiId, deliv2Id, deptMap['CN_THANHHOA'].id,
      new Date('2026-02-03T16:00:00Z'), 'RECEIVED', 'Lê Hữu Nam - CNTT Chi nhánh',
      'Đã nhận 2 PC bổ sung hoàn hảo, đủ tiêu chuẩn đưa vào vận hành.'
    ]
  );
  await db.query(
    `INSERT INTO receipt_confirmation_items (id, receipt_id, po_item_id, allocation_id, quantity_received, quantity_damaged, quantity_missing)
     VALUES ($1, $2, $3, $4, $5, $6, $7);`,
    [makeId(), rec3Id, poFtiItemPCId, allocPCThanhHoaId, 2, 0, 0]
  );

  // 13. Ghi nhận Lifecycle Events theo đúng Section I
  console.log('⏱️ Ghi nhận lịch sử vòng đời lifecycle_events...');
  const events = [
    { type: 'REQUEST', id: reqId, event: 'REQUEST_CREATED', old: null, newS: 'DRAFT', at: '2026-01-14T08:00:00Z', note: 'Khởi tạo hồ sơ mua sắm Q1' },
    { type: 'REQUEST', id: reqId, event: 'REQUEST_SUBMITTED', old: 'DRAFT', newS: 'SUBMITTED', at: '2026-01-15T09:00:00Z', note: 'Trình lãnh đạo phê duyệt' },
    { type: 'REQUEST', id: reqId, event: 'REQUEST_APPROVED', old: 'SUBMITTED', newS: 'APPROVED', at: '2026-01-18T14:30:00Z', note: 'Lãnh đạo phê duyệt toàn bộ' },
    { type: 'PURCHASE_ORDER', id: poFtiId, event: 'PO_GENERATED', old: null, newS: 'ISSUED', at: '2026-01-20T08:30:00Z', note: 'Sinh PO tự động cho NCC FTI' },
    { type: 'PURCHASE_ORDER', id: poFtiId, event: 'SUPPLIER_CONFIRMED', old: 'ISSUED', newS: 'SUPPLIER_CONFIRMED', at: '2026-01-21T10:00:00Z', note: 'FTI xác nhận tiếp nhận đơn hàng' },
    { type: 'DELIVERY', id: deliv1Id, event: 'DELIVERY_DISPATCHED', old: null, newS: 'DISPATCHED', at: '2026-01-25T10:00:00Z', note: 'FTI xuất kho đợt 1' },
    { type: 'RECEIPT', id: rec2Id, event: 'RECEIPT_DISCREPANCY', old: null, newS: 'DISCREPANCY', at: '2026-01-27T11:00:00Z', note: 'Thanh Hóa nhận thiếu 1 máy tính hỏng' },
    { type: 'DELIVERY', id: deliv2Id, event: 'DELIVERY_DISPATCHED', old: null, newS: 'DISPATCHED', at: '2026-02-02T14:00:00Z', note: 'FTI giao bổ sung đợt 2' },
    { type: 'RECEIPT', id: rec3Id, event: 'RECEIPT_CONFIRMED', old: null, newS: 'RECEIVED', at: '2026-02-03T16:00:00Z', note: 'Thanh Hóa nhận bổ sung đủ số lượng' }
  ];

  for (const ev of events) {
    await db.query(
      `INSERT INTO lifecycle_events (id, entity_type, entity_id, event_type, old_status, new_status, actor_id, actor_name, event_at, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
      [makeId(), ev.type, ev.id, ev.event, ev.old, ev.newS, userMap['qtts@namabank.com.vn'].id, 'Hệ thống Quản lý Mua sắm', new Date(ev.at), ev.note]
    );
  }

  console.log('✅ [SEED] Đã hoàn tất nạp 100% dữ liệu mẫu chuẩn Section N!');
}

// Chạy trực tiếp nếu gọi từ CLI
if (process.argv[1]?.endsWith('seed.js')) {
  runSeed()
    .then(() => {
      console.log('🎉 Seed cơ sở dữ liệu thành công.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Lỗi khi seed dữ liệu:', err);
      process.exit(1);
    });
}
