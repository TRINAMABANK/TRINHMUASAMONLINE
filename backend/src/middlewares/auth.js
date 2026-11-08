import jwt from 'jsonwebtoken';
import { queryOne, query } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'nam_a_bank_qtts_sso_secret_key_2026_super_secure_jwt';

/**
 * Middleware xác thực JWT token và nạp thông tin user kèm roles
 */
export async function authenticate(req, res, next) {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập. Không tìm thấy mã xác thực (Token).'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Lấy thông tin người dùng từ DB kèm vai trò (roles)
    const user = await queryOne(`
      SELECT u.id, u.email, u.full_name, u.department_id, u.supplier_id, u.is_active,
             d.name as department_name, d.code as department_code,
             s.name as supplier_name, s.code as supplier_code
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN suppliers s ON s.id = u.supplier_id
      WHERE u.id = $1
    `, [decoded.id]);

    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc đã bị khóa.'
      });
    }

    // Lấy danh sách mã role của user từ user_roles
    const roleRows = await query(`
      SELECT r.code, r.name 
      FROM roles r
      JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = $1
    `, [user.id]);

    const baseRoles = roleRows.map(r => r.code);
    user.roles = baseRoles;
    user.originalRoles = baseRoles;

    // Vai trò hiện hành (activeRole) được lấy từ JWT (nếu đã switch-role) hoặc mặc định là role gốc đầu tiên
    const activeRole = decoded.activeRole || decoded.role || baseRoles[0] || 'VIEWER';
    user.role = activeRole;
    user.activeRole = activeRole;

    if (decoded.department_id) user.department_id = decoded.department_id;
    if (decoded.supplier_id) user.supplier_id = decoded.supplier_id;

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Mã xác thực không hợp lệ hoặc đã hết hạn.',
      error: err.message
    });
  }
}

/**
 * Middleware kiểm tra vai trò người dùng (RBAC)
 * @param  {...string} allowedRoles Danh sách vai trò được phép
 */
export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập. Vui lòng đăng nhập lại.' });
    }

    const currentRole = req.user.activeRole || req.user.role;

    // Nếu vai trò hiện hành là ADMIN: toàn quyền truy cập
    if (currentRole === 'ADMIN') {
      return next();
    }

    // Chuẩn hóa tên vai trò tương đương (UNIT_USER tương đương DON_VI)
    const normalizedAllowed = allowedRoles.flatMap(r => {
      if (r === 'UNIT_USER') return ['UNIT_USER', 'DON_VI'];
      if (r === 'DON_VI') return ['UNIT_USER', 'DON_VI'];
      return [r];
    });

    const hasPermission = normalizedAllowed.includes(currentRole);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền thực hiện thao tác này. Quyền yêu cầu: [${allowedRoles.join(', ')}], vai trò hiện tại: [${currentRole}].`
      });
    }

    next();
  };
}
