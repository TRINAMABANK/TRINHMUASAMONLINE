import { useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api/authApi.js';

// Danh sách tài khoản demo theo từng vai trò để chuyển đổi nhanh khi kiểm thử
export const DEMO_ACCOUNTS = [
  { role: 'ADMIN', email: 'admin@namabank.com.vn', name: 'Quản trị viên Hệ thống (ADMIN)', desc: 'Toàn quyền cấu hình & quản trị' },
  { role: 'QTTS', email: 'qtts@namabank.com.vn', name: 'Nguyễn Văn A - Cán bộ QTTS', desc: 'Lập PO, nhập Excel, quản lý vòng đời' },
  { role: 'HCQT', email: 'hcqt@namabank.com.vn', name: 'Trần Thị B - Cán bộ HCQT', desc: 'Rà soát hồ sơ & phân loại TT' },
  { role: 'APPROVER', email: 'approver@namabank.com.vn', name: 'Lê Văn C - Lãnh đạo Phê duyệt', desc: 'Phê duyệt phiếu trình & PO' },
  { role: 'UNIT_USER', email: 'hanoi_unit@namabank.com.vn', name: 'Phạm Văn D - Cán bộ CN Hà Nội', desc: 'Tra cứu & xác nhận nhận hàng đơn vị' },
  { role: 'SUPPLIER', email: 'supplier_fti@namabank.com.vn', name: 'Đại diện Đối tác FTI Telecom', desc: 'Nhận đơn, hẹn giao, báo giao hàng' },
  { role: 'VIEWER', email: 'viewer@namabank.com.vn', name: 'Người xem dữ liệu (Viewer)', desc: 'Quyền chỉ xem dữ liệu' }
];

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(() => ({
    id: 'user_admin',
    email: 'admin@namabank.com.vn',
    name: 'Quản trị viên Hệ thống (ADMIN)',
    full_name: 'Quản trị viên Hệ thống (ADMIN)',
    role: 'ADMIN',
    roles: ['ADMIN']
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Khởi tạo phiên làm việc ban đầu
  const initAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      // Thử lấy thông tin tài khoản hiện tại từ token đã lưu
      const meRes = await authApi.getMe();
      if (meRes.success && meRes.data) {
        setCurrentUser(meRes.data);
        setIsLoading(false);
        return;
      }
    } catch (e) {
      // Nếu chưa đăng nhập hoặc token hết hạn, tự động đăng nhập tài khoản ADMIN mặc định để trải nghiệm liền mạch
      try {
        const loginRes = await authApi.login('admin@namabank.com.vn', 'NamABank@2026');
        if (loginRes.success && loginRes.data?.user) {
          setCurrentUser(loginRes.data.user);
        }
      } catch (err) {
        console.warn('Lỗi đăng nhập ban đầu:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Chuyển đổi nhanh vai trò người dùng (Rất tiện lợi khi kiểm thử phân quyền các Cổng)
  const switchRole = useCallback(async (targetRole) => {
    const acc = DEMO_ACCOUNTS.find(a => a.role === targetRole) || DEMO_ACCOUNTS[0];
    setIsLoading(true);
    setError(null);
    try {
      const loginRes = await authApi.login(acc.email, 'NamABank@2026');
      if (loginRes.success && loginRes.data?.user) {
        setCurrentUser(loginRes.data.user);
        return loginRes.data.user;
      }
    } catch (err) {
      setError(err.message);
      alert(`Lỗi chuyển đổi vai trò: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setCurrentUser(null);
  }, []);

  return {
    currentUser,
    role: currentUser?.role || 'ADMIN',
    isAuthenticated: !!currentUser,
    isLoading,
    error,
    switchRole,
    logout,
    refreshUser: initAuth
  };
}
