import crypto from 'crypto';
import { query, queryOne, transaction } from '../config/database.js';

/**
 * Sinh mã băm SHA-256 an toàn từ chuỗi token gốc
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Tạo lời mời đặt hàng qua link riêng cho một Nhà cung cấp trong PO
 */
export async function generateInvitation({ poId, supplierId, recipientEmail, currentUser, baseUrl = '' }) {
  // 1. Kiểm tra PO
  const po = await queryOne(`SELECT * FROM purchase_orders WHERE id = $1 AND deleted_at IS NULL`, [poId]);
  if (!po) {
    const err = new Error('Không tìm thấy đơn hàng Purchase Order.');
    err.statusCode = 404;
    throw err;
  }

  // 2. Kiểm tra Nhà cung cấp
  const supplier = await queryOne(`SELECT * FROM suppliers WHERE id = $1 AND deleted_at IS NULL`, [supplierId]);
  if (!supplier) {
    const err = new Error('Không tìm thấy nhà cung cấp.');
    err.statusCode = 404;
    throw err;
  }

  // 3. Lấy email người nhận
  const emailToUse = (recipientEmail || supplier.email || '').trim();
  if (!emailToUse) {
    const err = new Error('Vui lòng cung cấp email người nhận của nhà cung cấp.');
    err.statusCode = 400;
    throw err;
  }

  // 4. Sinh token ngẫu nhiên bảo mật 32 bytes (256-bit entropy)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Hiệu lực 30 ngày
  const invitationId = crypto.randomUUID();

  // 5. Thu hồi bất kỳ token cũ nào còn hiệu lực của cặp (PO, Supplier) này để tạo link mới
  await query(
    `UPDATE supplier_order_invitations 
     SET revoked_at = CURRENT_TIMESTAMP 
     WHERE purchase_order_id = $1 AND supplier_id = $2 AND revoked_at IS NULL`,
    [poId, supplierId]
  );

  // 6. Lưu invitation mới
  await query(
    `INSERT INTO supplier_order_invitations (id, supplier_id, purchase_order_id, recipient_email, token_hash, expires_at, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'EMAIL_DRAFT_CREATED', $7)`,
    [invitationId, supplierId, poId, emailToUse, tokenHash, expiresAt, currentUser?.id || null]
  );

  // 7. Tạo URL riêng gắn liền với token
  const origin = baseUrl ? baseUrl.replace(/\/$/, '') : 'https://quanlyts.com';
  const supplierLink = `${origin}/supplier-portal/${rawToken}`;

  // 8. Tạo nội dung email chuẩn bắt buộc theo Section A
  const poCode = po.po_number || po.po || 'PO';
  const subject = `NAM A BANK – ĐƠN ĐẶT HÀNG PO ${poCode}`;
  const body = `Kính gửi Quý Nhà cung cấp,

NAM A BANK gửi đến Quý Công ty đơn đặt hàng (PO) đính kèm.

Kính đề nghị Quý Công ty vui lòng truy cập đường link bên dưới để nhận thông tin đặt hàng, kiểm tra danh sách hàng hóa và xác nhận đơn đặt hàng, đồng thời cập nhật thời gian dự kiến giao hàng.

LINK XÁC NHẬN ĐẶT HÀNG:
${supplierLink}

Sau khi xác nhận đặt hàng, Quý Công ty vui lòng tiếp tục truy cập đường link trên để cập nhật tình trạng xuất kho và xác nhận hàng hóa đã giao.

ĐẦU MỐI LIÊN HỆ:

Mr. Trí
SĐT: 0982441446

Trân trọng,
NAM A BANK`;

  // 9. Lưu bản ghi nhật ký tạo nháp email (draft)
  const logId = crypto.randomUUID();
  await query(
    `INSERT INTO supplier_order_email_logs (id, invitation_id, recipient_email, subject, email_body, draft_created_at, created_by)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)`,
    [logId, invitationId, emailToUse, subject, body, currentUser?.id || null]
  );

  // 10. Ghi nhận lifecycle event
  await query(
    `INSERT INTO lifecycle_events (id, entity_type, entity_id, po_id, event_type, new_status, actor_id, actor_name, note)
     VALUES ($1, 'PURCHASE_ORDER', $2, $2, 'EMAIL_DRAFT_CREATED', 'EMAIL_DRAFT_CREATED', $3, $4, $5)`,
    [crypto.randomUUID(), poId, currentUser?.id || null, currentUser?.full_name || 'Admin', `Tạo bản nháp email đặt hàng cho NCC: ${supplier.name}`]
  );

  return {
    invitationId,
    token: rawToken,
    supplierLink,
    subject,
    body,
    recipientEmail: emailToUse,
    supplierName: supplier.name,
    supplierCode: supplier.code,
    poNumber: poCode,
    expiresAt
  };
}

/**
 * ADMIN xác nhận đã gửi email thành công bằng Gmail hoặc Outlook
 */
export async function confirmInvitationSent({ invitationId, currentUser }) {
  const inv = await queryOne(`SELECT * FROM supplier_order_invitations WHERE id = $1`, [invitationId]);
  if (!inv) {
    const err = new Error('Không tìm thấy thông tin lời mời đặt hàng.');
    err.statusCode = 404;
    throw err;
  }

  // Cập nhật trạng thái lời mời
  await query(
    `UPDATE supplier_order_invitations 
     SET status = 'EMAIL_SENT_CONFIRMED', updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [invitationId]
  );

  // Cập nhật log email
  await query(
    `UPDATE supplier_order_email_logs 
     SET admin_confirmed_sent_at = CURRENT_TIMESTAMP 
     WHERE invitation_id = $1 AND admin_confirmed_sent_at IS NULL`,
    [invitationId]
  );

  // Ghi nhận vòng đời PO
  await query(
    `INSERT INTO lifecycle_events (id, entity_type, entity_id, po_id, event_type, new_status, actor_id, actor_name, note)
     VALUES ($1, 'PURCHASE_ORDER', $2, $2, 'EMAIL_SENT_CONFIRMED', 'EMAIL_SENT_CONFIRMED', $3, $4, $5)`,
    [crypto.randomUUID(), inv.purchase_order_id, currentUser?.id || null, currentUser?.full_name || 'Admin', `Admin xác nhận đã gửi email đặt hàng tới: ${inv.recipient_email}`]
  );

  return { success: true, message: 'Đã xác nhận gửi email thành công.' };
}

/**
 * Gửi lại link riêng cho nhà cung cấp
 */
export async function resendInvitation({ invitationId, currentUser, baseUrl = '' }) {
  const inv = await queryOne(`SELECT * FROM supplier_order_invitations WHERE id = $1`, [invitationId]);
  if (!inv) {
    const err = new Error('Không tìm thấy lời mời đặt hàng.');
    err.statusCode = 404;
    throw err;
  }

  // Sinh token mới và gia hạn thêm 30 ngày
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await query(
    `UPDATE supplier_order_invitations 
     SET token_hash = $1, expires_at = $2, revoked_at = NULL, status = 'EMAIL_RESENT', updated_at = CURRENT_TIMESTAMP 
     WHERE id = $3`,
    [tokenHash, expiresAt, invitationId]
  );

  const po = await queryOne(`SELECT * FROM purchase_orders WHERE id = $1`, [inv.purchase_order_id]);
  const poCode = po ? (po.po_number || po.po || 'PO') : 'PO';
  const origin = baseUrl ? baseUrl.replace(/\/$/, '') : 'https://quanlyts.com';
  const supplierLink = `${origin}/supplier-portal/${rawToken}`;

  const subject = `NAM A BANK – ĐƠN ĐẶT HÀNG PO ${poCode} (GỬI LẠI LINK)`;
  const body = `Kính gửi Quý Nhà cung cấp,

NAM A BANK gửi lại Quý Công ty đường link riêng để xác nhận đơn đặt hàng PO ${poCode}.

LINK XÁC NHẬN ĐẶT HÀNG:
${supplierLink}

ĐẦU MỐI LIÊN HỆ:
Mr. Trí
SĐT: 0982441446

Trân trọng,
NAM A BANK`;

  await query(
    `INSERT INTO supplier_order_email_logs (id, invitation_id, recipient_email, subject, email_body, draft_created_at, created_by)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)`,
    [crypto.randomUUID(), invitationId, inv.recipient_email, subject, body, currentUser?.id || null]
  );

  return {
    invitationId,
    token: rawToken,
    supplierLink,
    subject,
    body,
    recipientEmail: inv.recipient_email,
    expiresAt
  };
}

/**
 * Thu hồi link đối tác
 */
export async function revokeInvitation({ invitationId, currentUser }) {
  const inv = await queryOne(`SELECT * FROM supplier_order_invitations WHERE id = $1`, [invitationId]);
  if (!inv) {
    const err = new Error('Không tìm thấy lời mời đặt hàng.');
    err.statusCode = 404;
    throw err;
  }

  await query(
    `UPDATE supplier_order_invitations 
     SET revoked_at = CURRENT_TIMESTAMP, status = 'REVOKED', updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [invitationId]
  );

  await query(
    `INSERT INTO lifecycle_events (id, entity_type, entity_id, po_id, event_type, new_status, actor_id, actor_name, note)
     VALUES ($1, 'PURCHASE_ORDER', $2, $2, 'LINK_REVOKED', 'REVOKED', $3, $4, $5)`,
    [crypto.randomUUID(), inv.purchase_order_id, currentUser?.id || null, currentUser?.full_name || 'Admin', `Đã thu hồi link đối tác gửi đến: ${inv.recipient_email}`]
  );

  return { success: true, message: 'Đã thu hồi link đối tác thành công.' };
}

/**
 * Lấy danh sách trạng thái gửi email và tiến độ của từng NCC trong PO
 */
export async function getPoSupplierManagement(poId) {
  // 1. Lấy thông tin PO
  const po = await queryOne(`SELECT * FROM purchase_orders WHERE id = $1 AND deleted_at IS NULL`, [poId]);
  if (!po) return null;

  // 2. Lấy tất cả items của PO để xác định các nhà cung cấp có trong PO
  const items = await query(
    `SELECT poi.*, s.id as supplier_id, s.name as supplier_name, s.code as supplier_code, s.email as supplier_email, s.phone as supplier_phone
     FROM purchase_order_items poi
     LEFT JOIN suppliers s ON s.id = poi.supplier_id OR LOWER(s.name) = LOWER(poi.supplier_name) OR LOWER(s.code) = LOWER(poi.supplier_name)
     WHERE poi.po_id = $1`,
    [poId]
  );

  // Tập hợp danh sách các nhà cung cấp duy nhất
  const supplierMap = new Map();
  for (const it of items) {
    const sId = it.supplier_id || it.supplier_code || it.supplier_name || 'UNKNOWN';
    if (!supplierMap.has(sId)) {
      supplierMap.set(sId, {
        supplierId: it.supplier_id,
        supplierCode: it.supplier_code || 'NCC',
        supplierName: it.supplier_name || 'Nhà cung cấp',
        supplierEmail: it.supplier_email || '',
        supplierPhone: it.supplier_phone || '',
        itemCount: 0,
        totalQty: 0,
        totalAmount: 0
      });
    }
    const sObj = supplierMap.get(sId);
    sObj.itemCount += 1;
    sObj.totalQty += Number(it.quantity || it.qty || 1);
    sObj.totalAmount += Number(it.total_price || it.amount || (Number(it.unit_price || it.price || 0) * Number(it.quantity || it.qty || 1)));
  }

  // 3. Lấy các invitations mới nhất cho PO này
  const invitations = await query(
    `SELECT soi.*, s.name as supplier_name, s.code as supplier_code
     FROM supplier_order_invitations soi
     JOIN suppliers s ON s.id = soi.supplier_id
     WHERE soi.purchase_order_id = $1
     ORDER BY soi.created_at DESC`,
    [poId]
  );

  // 4. Lấy các xác nhận PO từ NCC
  const confirmations = await query(
    `SELECT * FROM supplier_po_confirmations WHERE po_id = $1 ORDER BY confirmed_at DESC`,
    [poId]
  );

  // 5. Lấy danh sách các đợt giao hàng
  const deliveries = await query(
    `SELECT pod.*,
            (SELECT COUNT(*) FROM delivery_items di WHERE di.delivery_id = pod.id) as item_count,
            (SELECT COALESCE(SUM(quantity_delivered), 0) FROM delivery_items di WHERE di.delivery_id = pod.id) as total_delivered_qty
     FROM purchase_order_deliveries pod
     WHERE pod.po_id = $1
     ORDER BY pod.delivery_date DESC`,
    [poId]
  );

  // Tổng hợp dữ liệu theo từng nhà cung cấp
  const suppliersResult = Array.from(supplierMap.values()).map(sup => {
    // Tìm invitation gần nhất
    const inv = invitations.find(i => i.supplier_id === sup.supplierId || i.supplier_code === sup.supplierCode);
    const conf = confirmations.find(c => c.supplier_id === sup.supplierId);
    const supDeliveries = deliveries.filter(d => d.supplier_id === sup.supplierId);

    // Xác định trạng thái tổng hợp 8 giai đoạn theo Mục 8
    let workflowStatus = 'CHUA_TAO_EMAIL';
    let workflowLabel = 'Chưa tạo email';

    if (inv) {
      if (inv.revoked_at) {
        workflowStatus = 'REVOKED';
        workflowLabel = 'Link đã bị thu hồi';
      } else if (inv.status === 'EMAIL_DRAFT_CREATED') {
        workflowStatus = 'DA_TAO_EMAIL';
        workflowLabel = 'Đã tạo email (bản nháp)';
      } else if (inv.status === 'EMAIL_SENT_CONFIRMED' || inv.status === 'EMAIL_RESENT') {
        workflowStatus = 'ADMIN_DA_GUI';
        workflowLabel = 'ADMIN xác nhận đã gửi';
      }
    }

    if (conf) {
      workflowStatus = 'NCC_DA_XAC_NHAN';
      workflowLabel = 'Đối tác đã xác nhận PO';
      if (conf.expected_delivery_date) {
        workflowStatus = 'DA_CO_NGAY_GIAO';
        workflowLabel = `Đã có ngày dự kiến (${new Date(conf.expected_delivery_date).toLocaleDateString('vi-VN')})`;
      }
    }

    const totalDeliveredQty = supDeliveries.reduce((sum, d) => sum + Number(d.total_delivered_qty || 0), 0);
    if (supDeliveries.length > 0) {
      if (totalDeliveredQty < sup.totalQty) {
        workflowStatus = 'XUAT_KHO_MOT_PHAN';
        workflowLabel = `Đã xuất kho một phần (${totalDeliveredQty}/${sup.totalQty})`;
      } else {
        workflowStatus = 'DA_GIAO_DU';
        workflowLabel = `Đã giao đủ (${totalDeliveredQty}/${sup.totalQty})`;
      }
    }

    return {
      ...sup,
      invitation: inv || null,
      confirmation: conf || null,
      deliveries: supDeliveries,
      workflowStatus,
      workflowLabel,
      totalDeliveredQty
    };
  });

  return {
    poId: po.id,
    poNumber: po.po_number || po.po || 'PO',
    status: po.status,
    totalAmount: po.total_amount,
    suppliers: suppliersResult
  };
}

/**
 * CỔNG ĐỐI TÁC: Xác thực token và lấy dữ liệu chi tiết PO của đúng nhà cung cấp
 */
export async function verifyAndGetPortalData(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    const err = new Error('Thiếu token xác thực đối tác.');
    err.statusCode = 400;
    throw err;
  }

  const tokenHash = hashToken(rawToken);

  // 1. Kiểm tra lời mời trong DB
  const inv = await queryOne(
    `SELECT soi.*, s.name as supplier_name, s.code as supplier_code, s.tax_code, s.phone as supplier_phone,
            po.po_number, po.title as po_title, po.order_date, po.status as po_status, po.delivery_status
     FROM supplier_order_invitations soi
     JOIN suppliers s ON s.id = soi.supplier_id
     JOIN purchase_orders po ON po.id = soi.purchase_order_id
     WHERE soi.token_hash = $1`,
    [tokenHash]
  );

  if (!inv) {
    const err = new Error('Liên kết đối tác không hợp lệ hoặc không tồn tại.');
    err.statusCode = 404;
    throw err;
  }

  if (inv.revoked_at) {
    const err = new Error('Liên kết đặt hàng này đã bị thu hồi bởi Quản trị viên Nam A Bank.');
    err.statusCode = 403;
    throw err;
  }

  if (new Date(inv.expires_at) < new Date()) {
    const err = new Error('Liên kết đặt hàng đã hết thời hạn hiệu lực (quá 30 ngày). Vui lòng liên hệ cán bộ Nam A Bank.');
    err.statusCode = 403;
    throw err;
  }

  // 2. Lấy đúng các dòng hàng thuộc nhà cung cấp này
  const items = await query(
    `SELECT poi.id, poi.stt, poi.item_name, poi.specification, poi.unit,
            poi.quantity, poi.qty, poi.unit_price, poi.price, poi.total_price, poi.amount,
            poi.department_id, d.name as unit_name, d.address as unit_address
     FROM purchase_order_items poi
     LEFT JOIN departments d ON d.id = poi.department_id
     WHERE poi.po_id = $1 
       AND (poi.supplier_id = $2 OR LOWER(poi.supplier_name) = LOWER($3) OR LOWER(poi.supplier_name) = LOWER($4))
     ORDER BY poi.stt ASC`,
    [inv.purchase_order_id, inv.supplier_id, inv.supplier_name, inv.supplier_code]
  );

  // 3. Lấy thông tin xác nhận PO nếu đã có
  const confirmation = await queryOne(
    `SELECT * FROM supplier_po_confirmations 
     WHERE po_id = $1 AND supplier_id = $2 
     ORDER BY confirmed_at DESC LIMIT 1`,
    [inv.purchase_order_id, inv.supplier_id]
  );

  // 4. Lấy lịch sử tất cả các đợt giao hàng đã tạo
  const deliveries = await query(
    `SELECT pod.*,
            (SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'po_item_id', di.po_item_id,
                'quantity_delivered', di.quantity_delivered,
                'note', di.note
              )
            ) FROM delivery_items di WHERE di.delivery_id = pod.id) as items
     FROM purchase_order_deliveries pod
     WHERE pod.po_id = $1 AND pod.supplier_id = $2
     ORDER BY pod.delivery_date DESC`,
    [inv.purchase_order_id, inv.supplier_id]
  );

  // 5. Tính toán tiến độ giao theo từng mặt hàng
  const itemsWithProgress = items.map(item => {
    const targetQty = Number(item.quantity || item.qty || 1);
    let deliveredQty = 0;
    deliveries.forEach(deliv => {
      const dItems = Array.isArray(deliv.items) ? deliv.items : [];
      const match = dItems.find(di => di.po_item_id === item.id);
      if (match) {
        deliveredQty += Number(match.quantity_delivered || 0);
      }
    });
    return {
      ...item,
      orderedQty: targetQty,
      deliveredQty,
      remainingQty: Math.max(0, targetQty - deliveredQty)
    };
  });

  return {
    po: {
      id: inv.purchase_order_id,
      poNumber: inv.po_number || 'PO',
      title: inv.po_title,
      orderDate: inv.order_date,
      status: inv.po_status,
      deliveryStatus: inv.delivery_status
    },
    supplier: {
      id: inv.supplier_id,
      name: inv.supplier_name,
      code: inv.supplier_code,
      taxCode: inv.tax_code,
      phone: inv.supplier_phone
    },
    invitation: {
      id: inv.id,
      recipientEmail: inv.recipient_email,
      expiresAt: inv.expires_at,
      status: inv.status
    },
    items: itemsWithProgress,
    confirmation: confirmation || null,
    deliveries
  };
}

/**
 * CỔNG ĐỐI TÁC: Xác nhận đồng ý đặt hàng và nhập ngày dự kiến giao
 */
export async function portalConfirmPo({ rawToken, expectedDeliveryDate, note = '', confirmedByName = '', clientIp = '' }) {
  if (!expectedDeliveryDate) {
    const err = new Error('Vui lòng chọn ngày dự kiến giao hàng.');
    err.statusCode = 400;
    throw err;
  }

  const { po, supplier, invitation } = await verifyAndGetPortalData(rawToken);

  return await transaction(async (db) => {
    const confirmationId = crypto.randomUUID();
    const expDate = new Date(expectedDeliveryDate);

    // Lưu bảng supplier_po_confirmations
    await db.query(
      `INSERT INTO supplier_po_confirmations (id, invitation_id, po_id, supplier_id, expected_delivery_date, note, confirmed_by_name, confirmed_by_ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [confirmationId, invitation.id, po.id, supplier.id, expDate, note, confirmedByName || supplier.name, clientIp]
    );

    // Cập nhật PO
    await db.query(
      `UPDATE purchase_orders 
       SET supplier_confirmed_at = CURRENT_TIMESTAMP, 
           expected_delivery_date = $1,
           status = 'SUPPLIER_CONFIRMED'
       WHERE id = $2`,
      [expDate, po.id]
    );

    // Cập nhật status của invitation
    await db.query(
      `UPDATE supplier_order_invitations 
       SET status = 'PO_CONFIRMED', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [invitation.id]
    );

    // Ghi nhật ký lifecycle
    await db.query(
      `INSERT INTO lifecycle_events (id, entity_type, entity_id, po_id, event_type, new_status, actor_name, note)
       VALUES ($1, 'PURCHASE_ORDER', $2, $2, 'SUPPLIER_CONFIRMED', 'SUPPLIER_CONFIRMED', $3, $4)`,
      [crypto.randomUUID(), po.id, confirmedByName || supplier.name, `Nhà cung cấp đã xác nhận PO. Dự kiến giao hàng ngày: ${expDate.toLocaleDateString('vi-VN')}`]
    );

    return {
      success: true,
      message: 'Xác nhận đơn đặt hàng thành công.',
      expectedDeliveryDate: expDate
    };
  });
}

/**
 * CỔNG ĐỐI TÁC: Xác nhận đã xuất kho / giao hàng (hỗ trợ giao nhiều lần)
 */
export async function portalDispatchDelivery({
  rawToken,
  dispatchedAt,
  deliveredItems = [],
  deliveryNote = '',
  trackingNumber = '',
  carrier = '',
  confirmedByName = '',
  attachmentId = null,
  clientIp = ''
}) {
  const { po, supplier, items, invitation } = await verifyAndGetPortalData(rawToken);

  if (!deliveredItems || deliveredItems.length === 0) {
    const err = new Error('Vui lòng nhập số lượng thực tế đã giao cho ít nhất một mặt hàng.');
    err.statusCode = 400;
    throw err;
  }

  return await transaction(async (db) => {
    const deliveryId = crypto.randomUUID();
    const deliveryDate = dispatchedAt ? new Date(dispatchedAt) : new Date();
    const deliveryCode = `DELIV-${po.poNumber || 'PO'}-${Date.now().toString().slice(-6)}`;

    let batchDeliveredTotal = 0;

    // 1. Tạo bản ghi giao hàng mới trong purchase_order_deliveries
    await db.query(
      `INSERT INTO purchase_order_deliveries (
        id, po_id, delivery_code, supplier_id, delivery_date, dispatched_at, 
        carrier, tracking_number, note, delivery_note, attachment_id, confirmed_by, confirmed_at, status
       ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $8, $9, $10, CURRENT_TIMESTAMP, 'DISPATCHED')`,
      [
        deliveryId, po.id, deliveryCode, supplier.id, deliveryDate,
        carrier || 'Đội vận chuyển đối tác', trackingNumber || deliveryCode,
        deliveryNote, attachmentId || null, confirmedByName || supplier.name
      ]
    );

    // 2. Thêm từng dòng hàng vào delivery_items
    for (const dItem of deliveredItems) {
      const q = Number(dItem.quantity_delivered || 0);
      if (q > 0) {
        batchDeliveredTotal += q;
        await db.query(
          `INSERT INTO delivery_items (id, delivery_id, po_item_id, quantity_delivered, note)
           VALUES ($1, $2, $3, $4, $5)`,
          [crypto.randomUUID(), deliveryId, dItem.po_item_id, q, dItem.note || '']
        );
      }
    }

    // 3. Tính toán tổng lũy kế đã giao của toàn bộ đơn hàng
    const totalOrdered = items.reduce((sum, it) => sum + it.orderedQty, 0);
    const existingDelivered = items.reduce((sum, it) => sum + it.deliveredQty, 0);
    const newCumulative = existingDelivered + batchDeliveredTotal;

    const isFullyDelivered = newCumulative >= totalOrdered;
    const newStatus = isFullyDelivered ? 'DA_GIAO_DU' : 'XUAT_KHO_MOT_PHAN';

    // 4. Cập nhật trạng thái PO
    await db.query(
      `UPDATE purchase_orders 
       SET dispatched_at = $1, delivery_status = $2 
       WHERE id = $3`,
      [deliveryDate, newStatus, po.id]
    );

    // 5. Cập nhật trạng thái invitation
    await db.query(
      `UPDATE supplier_order_invitations 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [newStatus, invitation.id]
    );

    // 6. Ghi nhận lifecycle event
    await db.query(
      `INSERT INTO lifecycle_events (id, entity_type, entity_id, po_id, event_type, new_status, actor_name, note)
       VALUES ($1, 'PURCHASE_ORDER', $2, $2, 'DELIVERY_DISPATCHED', $3, $4, $5)`,
      [
        crypto.randomUUID(), po.id, newStatus, confirmedByName || supplier.name,
        `Nhà cung cấp thông báo xuất kho đợt giao ${deliveryCode}. Số lượng: ${batchDeliveredTotal} sp. Trạng thái: ${isFullyDelivered ? 'ĐÃ GIAO ĐỦ' : 'XUẤT KHO MỘT PHẦN'}`
      ]
    );

    return {
      success: true,
      message: `Xác nhận xuất kho đợt ${deliveryCode} thành công.`,
      deliveryId,
      deliveryCode,
      status: newStatus,
      isFullyDelivered
    };
  });
}
