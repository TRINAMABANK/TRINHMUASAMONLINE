import React, { useState, useEffect, useMemo } from 'react';
import { Dashboard } from './pages/Dashboard.jsx';
import { ImportPage } from './pages/ImportPage.jsx';
import { POManagement } from './pages/POManagement.jsx';
import { ExportPage } from './pages/ExportPage.jsx';
import { ReportPage } from './pages/ReportPage.jsx';
import { UnitPortalPage } from './pages/UnitPortalPage.jsx';
import { SupplierPortalPage } from './pages/SupplierPortalPage.jsx';
import { ReceiptConfirmationPage } from './pages/ReceiptConfirmationPage.jsx';
import { DeliveryTrackingPage } from './pages/DeliveryTrackingPage.jsx';
import { LifecycleReportsPage } from './pages/LifecycleReportsPage.jsx';

import { NotificationBell } from './components/NotificationBell.jsx';
import { AdminLoginModal } from './components/AdminLoginModal.jsx';

import { usePOManagement } from './hooks/usePOManagement.js';
import { useAuth } from './hooks/useAuth.js';

import {
  LayoutDashboard,
  FileSpreadsheet,
  FolderKanban,
  FileDown,
  BarChart2,
  Building,
  Building2,
  Store,
  PackageCheck,
  Truck,
  TrendingUp,
  UserCheck,
  ShieldCheck,
  LogOut,
  Eye
} from 'lucide-react';
import './styles/main.css';

export function App() {
  const { currentUser, setCurrentUser, logout, refreshUser, isLoading: authLoading } = useAuth();

  // Đọc tham số URL khi đối tác truy cập bằng link riêng
  const initialUrlParams = useMemo(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      return {
        view: sp.get('view') || '',
        po: sp.get('po') || '',
        supplier: sp.get('supplier') || ''
      };
    }
    return { view: '', po: '', supplier: '' };
  }, []);

  // Nhận diện token đối tác qua URL /supplier-portal/:token hoặc ?token=...
  const supplierToken = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const path = window.location.pathname;
    if (path.startsWith('/supplier-portal/')) {
      const parts = path.replace('/supplier-portal/', '').split('/');
      return parts[0]?.split('?')[0] || '';
    }
    const sp = new URLSearchParams(window.location.search);
    return sp.get('token') || '';
  }, []);

  // Modal đăng nhập luôn luôn popup trước khi vào phần mềm nếu chưa có user
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !currentUser && !supplierToken) {
      setShowLoginModal(true);
    } else if (currentUser) {
      setShowLoginModal(false);
    }
  }, [authLoading, currentUser, supplierToken]);

  const [currentView, setCurrentView] = useState(() => {
    if (initialUrlParams.view === 'supplier_portal' || initialUrlParams.supplier || (initialUrlParams.po && initialUrlParams.view !== 'pos')) {
      return 'supplier_portal';
    }
    return 'dashboard';
  });

  const [receiptPreselectedPOId, setReceiptPreselectedPOId] = useState('');

  const {
    pos,
    activePOId,
    setActivePOId,
    isExporting,
    refreshPOs,
    createPO,
    updateStatus,
    updateOrderInfo,
    exportPO,
    deletePO,
    seedDemoData,
    generateNextPO
  } = usePOManagement();

  // Tự động điều chuyển màn hình phù hợp với vai trò của user khi đăng nhập thành công
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setShowLoginModal(false);
    const r = user?.role;
    if (r === 'UNIT_USER' || r === 'DON_VI') {
      setCurrentView('unit_portal');
    } else if (r === 'SUPPLIER') {
      setCurrentView('supplier_portal');
    } else if (r === 'APPROVER') {
      setCurrentView('pos');
    } else if (r === 'VIEWER') {
      setCurrentView('dashboard');
    } else {
      // ADMIN, QTTS, HCQT
      setCurrentView('import');
    }
  };

  const handleLogout = () => {
    logout();
    setShowLoginModal(true);
  };

  // Đếm số lượng hồ sơ cần phê duyệt
  const pendingCount = pos.filter(p => ['Chờ trình ký', 'Đã trình ký', 'CHO_DUYET', 'KHOI_TAO'].includes(p.status || p.submission_status)).length;

  // Điều hướng và mở modal PO
  const handleOpenPO = (id) => {
    setActivePOId(id);
    setCurrentView('pos');
  };

  // Điều hướng sang Cổng xác nhận nhận hàng
  const handleNavigateToReceipt = (poId) => {
    setReceiptPreselectedPOId(poId);
    setCurrentView('receipt');
  };

  // Xác định quyền hạn theo đúng vai trò thực tế của người dùng đã đăng nhập (RBAC)
  const userRole = currentUser?.role || null;

  const canAccessDashboard = ['ADMIN', 'QTTS', 'HCQT', 'APPROVER', 'VIEWER'].includes(userRole);
  const canAccessImport = ['ADMIN', 'QTTS', 'HCQT'].includes(userRole);
  const canAccessPOs = ['ADMIN', 'QTTS', 'HCQT', 'APPROVER', 'VIEWER'].includes(userRole);
  const canAccessUnitPortal = ['ADMIN', 'UNIT_USER', 'DON_VI'].includes(userRole);
  const canAccessSupplierPortal = ['ADMIN', 'SUPPLIER'].includes(userRole);
  const canAccessReceipt = ['ADMIN', 'QTTS', 'UNIT_USER', 'DON_VI', 'HCQT'].includes(userRole);
  const canAccessDeliveries = ['ADMIN', 'QTTS', 'HCQT'].includes(userRole);
  const canAccessExports = ['ADMIN', 'QTTS', 'HCQT'].includes(userRole);
  const canAccessReports = ['ADMIN', 'QTTS', 'HCQT', 'APPROVER', 'VIEWER'].includes(userRole);

  // Huy hiệu hiển thị tương ứng vai trò người dùng trên Topbar
  const getRoleBadge = (roleCode) => {
    switch (roleCode) {
      case 'ADMIN':
        return { label: 'Quản trị viên (ADMIN)', bg: '#fef2f2', color: '#991b1b', icon: ShieldCheck };
      case 'QTTS':
        return { label: 'Cán bộ QTTS', bg: '#eff6ff', color: '#1e40af', icon: ShieldCheck };
      case 'HCQT':
        return { label: 'Cán bộ HCQT', bg: '#f0fdf4', color: '#166534', icon: ShieldCheck };
      case 'APPROVER':
        return { label: 'Lãnh đạo Phê duyệt', bg: '#faf5ff', color: '#6b21a8', icon: UserCheck };
      case 'DON_VI':
      case 'UNIT_USER':
        return { label: 'Cán bộ Đơn vị (CN/PGD)', bg: '#fffbeb', color: '#92400e', icon: Building2 };
      case 'SUPPLIER':
        return { label: 'Đối tác / NCC', bg: '#fff7ed', color: '#9a3412', icon: Store };
      default:
        return { label: 'Người xem (VIEWER)', bg: '#f8fafc', color: '#475569', icon: Eye };
    }
  };

  const currentBadge = getRoleBadge(userRole);
  const CurrentRoleIcon = currentBadge.icon;

  // 0. Nếu đối tác truy cập qua link riêng có token -> hiển thị trực tiếp Cổng Đối Tác (không có menu quản trị)
  if (supplierToken) {
    return <SupplierPortalPage token={supplierToken} />;
  }

  return (
    <div className="app-layout">
      {/* Sidebar bên trái */}
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon-box">
              <Building size={22} />
            </div>
            <div className="brand-text">
              <h1>NAM A BANK</h1>
              <span>QTTS · Mua Sắm Online</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {/* 1. Tổng quan Dashboard */}
          {canAccessDashboard && (
            <button
              type="button"
              className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentView('dashboard')}
            >
              <LayoutDashboard size={18} />
              Tổng quan (Dashboard)
            </button>
          )}

          {/* 2. Nhập Phiếu & Tạo PO (QTTS / ADMIN / HCQT) */}
          {canAccessImport && (
            <button
              type="button"
              className={`nav-item ${currentView === 'import' ? 'active' : ''}`}
              onClick={() => setCurrentView('import')}
            >
              <FileSpreadsheet size={18} />
              Nhập Phiếu & Tạo PO
            </button>
          )}

          {/* 3. Hồ sơ PO & Trình ký */}
          {canAccessPOs && (
            <button
              type="button"
              className={`nav-item ${currentView === 'pos' ? 'active' : ''}`}
              onClick={() => setCurrentView('pos')}
            >
              <FolderKanban size={18} />
              Hồ sơ PO & Trình ký
              {pendingCount > 0 && (
                <span className="nav-badge">{pendingCount}</span>
              )}
            </button>
          )}

          {/* 4. Cổng Tra Cứu Đơn Vị (Chi nhánh, PGD, OneBank) */}
          {canAccessUnitPortal && (
            <button
              type="button"
              className={`nav-item ${currentView === 'unit_portal' ? 'active' : ''}`}
              onClick={() => setCurrentView('unit_portal')}
            >
              <Building2 size={18} />
              Cổng Tra Cứu Đơn Vị
            </button>
          )}

          {/* 5. Cổng Đối Tác / Nhà Cung Cấp */}
          {canAccessSupplierPortal && (
            <button
              type="button"
              className={`nav-item ${currentView === 'supplier_portal' ? 'active' : ''}`}
              onClick={() => setCurrentView('supplier_portal')}
            >
              <Store size={18} />
              Cổng Đối Tác / NCC
            </button>
          )}

          {/* 6. Xác nhận nhận hàng & Nghiệm thu */}
          {canAccessReceipt && (
            <button
              type="button"
              className={`nav-item ${currentView === 'receipt' ? 'active' : ''}`}
              onClick={() => setCurrentView('receipt')}
            >
              <PackageCheck size={18} />
              Xác nhận nhận hàng
            </button>
          )}

          {/* 7. Theo dõi giao hàng Logistics */}
          {canAccessDeliveries && (
            <button
              type="button"
              className={`nav-item ${currentView === 'deliveries' ? 'active' : ''}`}
              onClick={() => setCurrentView('deliveries')}
            >
              <Truck size={18} />
              Theo dõi giao hàng
            </button>
          )}

          {/* 8. Báo cáo SLA & Vòng đời */}
          {canAccessReports && (
            <button
              type="button"
              className={`nav-item ${currentView === 'reports' ? 'active' : ''}`}
              onClick={() => setCurrentView('reports')}
            >
              <BarChart2 size={18} />
              Báo cáo & SLA Vòng đời
            </button>
          )}

          {/* 9. Xuất File Excel (02 Sheet) */}
          {canAccessExports && (
            <button
              type="button"
              className={`nav-item ${currentView === 'exports' ? 'active' : ''}`}
              onClick={() => setCurrentView('exports')}
            >
              <FileDown size={18} />
              Xuất File Excel (02 Sheet)
            </button>
          )}
        </nav>

        <div className="sidebar-footer">
          <div>Hệ thống SSO 2.0 · BP QTTS</div>
          <div style={{ marginTop: 4, opacity: 0.7 }}>Kiến trúc Module hóa 2026</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="app-main">
        {/* Topbar trên cùng */}
        <header className="app-topbar">
          <div className="topbar-left">
            <span className="system-tag">Nam A Bank · QTTS SSO 2.0</span>
            <span className="text-muted text-xs">
              Mẫu chuẩn: 01 File Excel gồm đúng 02 Sheet (1. PHIẾU TRÌNH & 2. BẢNG KÊ)
            </span>
          </div>

          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Chuông thông báo nghiệp vụ */}
            <NotificationBell currentUser={currentUser} onNavigateToPO={handleOpenPO} />

            {/* Thông tin tài khoản đăng nhập tương ứng */}
            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    background: '#ffffff',
                    border: '1px solid #dce4ee',
                    borderRadius: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: currentBadge.bg,
                      color: currentBadge.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <CurrentRoleIcon size={15} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                    <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px' }}>
                      {currentUser?.full_name || currentUser?.name || currentUser?.email}
                    </span>
                    <span style={{ fontSize: '11px', color: currentBadge.color, fontWeight: 600 }}>
                      {currentBadge.label} {currentUser?.department_name ? `• ${currentUser.department_name}` : currentUser?.supplier_name ? `• ${currentUser.supplier_name}` : ''}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    background: '#fff',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '6px 11px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                  title="Đăng xuất khỏi hệ thống"
                >
                  <LogOut size={14} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                style={{
                  background: '#003366',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '7px 14px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                🔐 Đăng nhập hệ thống
              </button>
            )}
          </div>
        </header>

        {/* Nội dung trang */}
        <div className="app-content">
          {currentView === 'dashboard' && (
            <Dashboard
              pos={pos}
              onNavigate={setCurrentView}
              onOpenPO={handleOpenPO}
              currentUser={currentUser}
            />
          )}

          {currentView === 'import' && (
            <ImportPage
              onCreatePO={createPO}
              onNavigateToPO={handleOpenPO}
              onRefreshPOs={refreshPOs}
            />
          )}

          {currentView === 'pos' && (
            <POManagement
              pos={pos}
              activePOId={activePOId}
              setActivePOId={setActivePOId}
              onUpdateStatus={updateStatus}
              onUpdateOrderInfo={updateOrderInfo}
              onExportPO={exportPO}
              onDeletePO={deletePO}
              onSeedDemo={seedDemoData}
              onNavigateToReceipt={handleNavigateToReceipt}
              refreshPOs={refreshPOs}
              currentUser={currentUser}
            />
          )}

          {currentView === 'unit_portal' && (
            <UnitPortalPage
              pos={pos}
              currentUser={currentUser}
              onNavigateToReceipt={handleNavigateToReceipt}
            />
          )}

          {currentView === 'supplier_portal' && (
            <SupplierPortalPage
              pos={pos}
              currentUser={currentUser}
              onRefreshPOs={refreshPOs}
            />
          )}

          {currentView === 'receipt' && (
            <ReceiptConfirmationPage
              pos={pos}
              preselectedPOId={receiptPreselectedPOId}
              onUpdateOrderInfo={updateOrderInfo}
              onRefreshPOs={refreshPOs}
              currentUser={currentUser}
            />
          )}

          {currentView === 'deliveries' && (
            <DeliveryTrackingPage
              pos={pos}
              onRefreshPOs={refreshPOs}
              currentUser={currentUser}
            />
          )}

          {currentView === 'reports' && (
            <LifecycleReportsPage
              pos={pos}
            />
          )}

          {currentView === 'exports' && (
            <ExportPage
              pos={pos}
              onExportPO={exportPO}
              isExporting={isExporting}
            />
          )}
        </div>
      </main>

      {/* Modal đăng nhập luôn luôn popup trước khi vào phần mềm */}
      <AdminLoginModal
        isOpen={showLoginModal || (!currentUser && !supplierToken && !authLoading)}
        canClose={Boolean(currentUser)}
        onClose={() => {
          if (currentUser) setShowLoginModal(false);
        }}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}

export default App;
