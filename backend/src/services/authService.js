import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, queryOne } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'nam_a_bank_qtts_sso_secret_key_2026_super_secure_jwt';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export async function loginUser(email, password) {
  const normEmail = String(email || '').trim().toLowerCase();
  const isSearchAdmin = normEmail === 'admin' || normEmail === 'admin@quanlyts.com';

  const user = await queryOne(
    `SELECT u.id, u.email, u.password_hash, u.secondary_hash, u.full_name, u.phone, u.department_id, u.supplier_id, u.is_active,
            d.name as department_name, d.code as department_code, d.type as department_type,
            s.name as supplier_name, s.code as supplier_code
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     LEFT JOIN suppliers s ON u.supplier_id = s.id
     WHERE LOWER(u.email) = LOWER($1) 
        OR ($2 = true AND (LOWER(u.email) IN ('admin@namabank.com.vn', 'admin@quanlyts.com') OR u.full_name LIKE '%Quản trị%'))
        OR ($1 = 'hanoi_unit@namabank.com.vn' AND LOWER(u.email) = 'cnhanoi@namabank.com.vn')
        OR ($1 = 'supplier_fti@namabank.com.vn' AND LOWER(u.email) = 'ncc_fti@supplier.com')
        OR ($1 = 'hcqt@namabank.com.vn' AND LOWER(u.email) = 'qtts@namabank.com.vn')
     LIMIT 1`,
    [normEmail, isSearchAdmin]
  );

  if (!user) {
    throw new Error('Tài khoản hoặc mật khẩu không chính xác.');
  }

  if (!user.is_active) {
    throw new Error('Tài khoản đã bị tạm khóa. Vui lòng liên hệ quản trị viên.');
  }

  // Xác thực mật khẩu CHÍNH XÁC bằng bcrypt compare, KHÔNG so sánh văn bản thuần!
  let isMatch = false;
  if (user.password_hash) {
    isMatch = await bcrypt.compare(password, user.password_hash);
  }
  if (!isMatch && user.secondary_hash) {
    isMatch = await bcrypt.compare(password, user.secondary_hash);
  }

  if (!isMatch) {
    throw new Error('Tài khoản hoặc mật khẩu không chính xác.');
  }

  // Lấy roles từ user_roles
  const roleRows = await query(`
    SELECT r.code, r.name 
    FROM roles r
    JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = $1
  `, [user.id]);

  const roles = roleRows.map(r => r.code);
  const primaryRole = roles[0] || 'VIEWER';

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: primaryRole,
      roles: roles,
      department_id: user.department_id,
      supplier_id: user.supplier_id
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  // Tạo refresh token lưu vào bảng refresh_tokens
  const refreshTokenHash = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 ngày
  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [crypto.randomUUID(), user.id, refreshTokenHash, expiresAt]
  );

  return {
    token,
    refreshToken: refreshTokenHash,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: primaryRole,
      roles: roles,
      department_id: user.department_id,
      department_name: user.department_name,
      department_code: user.department_code,
      department_type: user.department_type,
      supplier_id: user.supplier_id,
      supplier_name: user.supplier_name,
      supplier_code: user.supplier_code,
      phone: user.phone
    }
  };
}

export async function refreshUserToken(tokenHash) {
  if (!tokenHash) throw new Error('Yêu cầu refresh token.');

  const rfRecord = await queryOne(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
    [tokenHash]
  );

  if (!rfRecord) {
    throw new Error('Refresh token không hợp lệ hoặc đã hết hạn.');
  }

  const user = await getUserProfile(rfRecord.user_id);
  if (!user || !user.is_active) {
    throw new Error('Tài khoản không hoạt động.');
  }

  const newToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      roles: user.roles,
      department_id: user.department_id,
      supplier_id: user.supplier_id
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return { token: newToken };
}

export async function logoutUser(userId, tokenHash) {
  if (tokenHash) {
    await query(`UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1`, [tokenHash]);
  } else if (userId) {
    await query(`UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1`, [userId]);
  }
  return true;
}

export async function switchUserRole(currentUser, targetRole) {
  if (!currentUser || !currentUser.id) {
    const err = new Error('Yêu cầu đăng nhập trước khi chuyển đổi vai trò.');
    err.statusCode = 401;
    throw err;
  }

  const normTarget = String(targetRole || '').trim().toUpperCase();
  const validRoles = ['ADMIN', 'QTTS', 'HCQT', 'APPROVER', 'DON_VI', 'UNIT_USER', 'SUPPLIER', 'VIEWER'];
  if (!validRoles.includes(normTarget)) {
    const err = new Error(`Vai trò '${targetRole}' không hợp lệ trên hệ thống.`);
    err.statusCode = 400;
    throw err;
  }

  // 1. Kiểm tra vai trò gốc của người dùng từ cơ sở dữ liệu
  const roleRows = await query(`
    SELECT r.code, r.name 
    FROM roles r
    JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = $1
  `, [currentUser.id]);

  const baseRoles = roleRows.map(r => r.code);
  const isBaseAdmin = baseRoles.includes('ADMIN');

  // 2. Kiểm tra quyền nâng cấp vai trò:
  // - Nếu không phải ADMIN gốc: TUYỆT ĐỐI KHÔNG được nâng quyền lên ADMIN
  if (normTarget === 'ADMIN' && !isBaseAdmin) {
    const err = new Error('Bạn không có quyền chuyển đổi hoặc nâng quyền lên Quản trị viên (ADMIN).');
    err.statusCode = 403;
    throw err;
  }

  // - Nếu không phải ADMIN gốc: chỉ được chuyển giữa các roles được gán trong DB hoặc VIEWER
  const mappedTarget = (normTarget === 'UNIT_USER') ? 'DON_VI' : normTarget;
  if (!isBaseAdmin && normTarget !== 'VIEWER') {
    const hasRole = baseRoles.some(r => r === normTarget || r === mappedTarget);
    if (!hasRole) {
      const err = new Error(`Tài khoản của bạn không được gán vai trò '${targetRole}'.`);
      err.statusCode = 403;
      throw err;
    }
  }

  // 3. Chuẩn bị context department hoặc supplier nếu ADMIN chuyển role để kiểm thử giao diện
  let activeDeptId = currentUser.department_id;
  let activeDeptName = currentUser.department_name;
  let activeDeptCode = currentUser.department_code;
  let activeDeptType = currentUser.department_type;

  let activeSuppId = currentUser.supplier_id;
  let activeSuppName = currentUser.supplier_name;
  let activeSuppCode = currentUser.supplier_code;

  if (normTarget === 'DON_VI' || normTarget === 'UNIT_USER') {
    if (!activeDeptId) {
      const dept = await queryOne(`SELECT * FROM departments WHERE type = 'CHI_NHANH' ORDER BY code ASC LIMIT 1`);
      if (dept) {
        activeDeptId = dept.id;
        activeDeptName = dept.name;
        activeDeptCode = dept.code;
        activeDeptType = dept.type;
      }
    }
  } else if (normTarget === 'SUPPLIER') {
    if (!activeSuppId) {
      const supp = await queryOne(`SELECT * FROM suppliers WHERE is_active = TRUE ORDER BY code ASC LIMIT 1`);
      if (supp) {
        activeSuppId = supp.id;
        activeSuppName = supp.name;
        activeSuppCode = supp.code;
      }
    }
  }

  // 4. Sinh JWT Token mới với vai trò hiện hành (activeRole)
  const activeRole = normTarget;
  const token = jwt.sign(
    {
      id: currentUser.id,
      email: currentUser.email,
      role: activeRole,
      activeRole: activeRole,
      roles: baseRoles,
      originalRoles: baseRoles,
      department_id: activeDeptId,
      supplier_id: activeSuppId
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    token,
    user: {
      id: currentUser.id,
      email: currentUser.email,
      full_name: currentUser.full_name,
      role: activeRole,
      activeRole: activeRole,
      roles: baseRoles,
      originalRoles: baseRoles,
      department_id: activeDeptId,
      department_name: activeDeptName,
      department_code: activeDeptCode,
      department_type: activeDeptType,
      supplier_id: activeSuppId,
      supplier_name: activeSuppName,
      supplier_code: activeSuppCode,
      phone: currentUser.phone
    }
  };
}

export async function getUserProfile(userId, activeRole = null) {
  const user = await queryOne(
    `SELECT u.id, u.email, u.full_name, u.department_id, u.supplier_id, u.phone, u.is_active,
            d.name as department_name, d.code as department_code, d.type as department_type,
            s.name as supplier_name, s.code as supplier_code
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     LEFT JOIN suppliers s ON u.supplier_id = s.id
     WHERE u.id = $1`,
    [userId]
  );

  if (!user) return null;

  const roleRows = await query(`
    SELECT r.code, r.name 
    FROM roles r
    JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = $1
  `, [user.id]);

  user.roles = roleRows.map(r => r.code);
  user.originalRoles = user.roles;
  user.role = activeRole || user.roles[0] || 'VIEWER';
  user.activeRole = user.role;

  return user;
}

export async function getDepartmentsList() {
  return await query(`SELECT * FROM departments WHERE deleted_at IS NULL ORDER BY type, name ASC`);
}

export async function getSuppliersList() {
  return await query(`SELECT * FROM suppliers WHERE is_active = TRUE AND deleted_at IS NULL ORDER BY name ASC`);
}

export async function getUsersList() {
  const users = await query(`
    SELECT u.id, u.email, u.full_name, u.phone, u.department_id, u.supplier_id, u.is_active,
           d.name as department_name, s.name as supplier_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN suppliers s ON u.supplier_id = s.id
    WHERE u.deleted_at IS NULL
    ORDER BY u.created_at DESC
  `);
  return users;
}
