import { loginUser, switchUserRole, getUserProfile, refreshUserToken, logoutUser, getUsersList, getDepartmentsList, getSuppliersList } from '../services/authService.js';
import { logAudit } from '../middlewares/errorHandler.js';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email và mật khẩu.' });
    }

    const data = await loginUser(email, password);
    await logAudit(data.user.id, data.user.full_name, data.user.role, 'LOGIN', 'USER', data.user.id, null, null, req.ip);

    res.cookie('token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({
      success: true,
      message: 'Đăng nhập thành công.',
      data
    });
  } catch (err) {
    next(err);
  }
}

export async function switchRoleHandler(req, res, next) {
  try {
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp vai trò cần chuyển đổi.' });
    }

    const data = await switchUserRole(req.user, role);
    await logAudit(
      req.user.id,
      req.user.full_name,
      role,
      'SWITCH_ROLE',
      'USER',
      req.user.id,
      { previousRole: req.user.role },
      { activeRole: role },
      req.ip
    );

    res.cookie('token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({
      success: true,
      message: `Chuyển đổi sang vai trò ${role} thành công.`,
      data
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
}

export async function refreshToken(req, res, next) {
  try {
    const { refreshToken: rToken } = req.body;
    const result = await refreshUserToken(rToken);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const { refreshToken: rToken } = req.body;
    await logoutUser(req.user?.id, rToken);
    res.clearCookie('token');
    res.json({ success: true, message: 'Đăng xuất thành công.' });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await getUserProfile(req.user.id, req.user.activeRole || req.user.role);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    if (req.user.department_id) user.department_id = req.user.department_id;
    if (req.user.supplier_id) user.supplier_id = req.user.supplier_id;

    res.json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
}

export async function getUsers(req, res, next) {
  try {
    const users = await getUsersList();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

export async function getDepartments(req, res, next) {
  try {
    const departments = await getDepartmentsList();
    res.json({ success: true, data: departments });
  } catch (err) {
    next(err);
  }
}

export async function getSuppliers(req, res, next) {
  try {
    const suppliers = await getSuppliersList();
    res.json({ success: true, data: suppliers });
  } catch (err) {
    next(err);
  }
}
