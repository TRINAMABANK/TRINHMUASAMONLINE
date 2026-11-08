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
  ShieldCheck
} from 'lucide-react';
import './styles/main.css';

export function App() {
  const { currentUser, role, refreshUser, isLoading: authLoading } = useAuth();

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

  // Nhận diện đường dẫn /admin hoặc view=admin
  const isAdminPath = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/admin') ||
    window.location.search.includes('view=admin')
  );
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(isAdminPath);

  const [currentView, setCurrentView] = useState(() => {
    if (initialUrlParams.view === 'supplier_portal' || initialUrlParams.supplier || (initialUrlParams.po && initialUrlParams.view !== 'pos')) {
      return 'supplier_portal';
    }
    if (isAdminPath) {
      return 'dashboard';
    }
    return 'import'; // Mặc định vào quy trình nhập phiếu thô
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

  // Tự động chuyển view phù hợp khi đổi vai trò người dùng
  useEffect(() => {
    if (role === 'UNIT_USER' && (currentView === 'import' || currentView === 'supplier_portal')) {
      setCurrentView('unit_portal');
    } else if (role === 'SUPPLIER' && (currentView === 'import' || currentView === 'unit_portal')) {
      setCurrentView('supplier_portal');
    }
  }, [role]);

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

  // Toàn bộ tính năng mở đầy đủ cho Quản trị viên (ADMIN)
  const canAccessImport = true;
  const canAccessPOs = true;
  const canAccessUnitPortal = true;
  const canAccessSupplierPortal = true;
  const canAccessReceipt = true;
  const canAccessDeliveries = true;
  const canAccessExports = true;
  const canAccessReports = true;

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
          <button
            type="button"
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            <LayoutDashboard size={18} />
            Tổng quan (Dashboard)
          </button>

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
            {/* Nút đăng nhập Quản trị Admin */}
            <button
              type="button"
              onClick={() => setShowAdminLoginModal(true)}
              style={{
                background: '#003366',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              title="Đăng nhập trang quản trị (Admin / Admin2026)"
            >
              🔐 Admin Portal
            </button>

            {/* Chuông thông báo nghiệp vụ */}
            <NotificationBell currentUser={currentUser} onNavigateToPO={handleOpenPO} />

            {/* Thông tin tài khoản Quản trị viên (ADMIN) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
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
                  background: '#fef2f2',
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ShieldCheck size={16} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px' }}>
                  {currentUser?.full_name || 'Quản trị viên Hệ thống'}
                </span>
                <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600 }}>
                  Quản trị viên (ADMIN) • Toàn quyền
                </span>
              </div>
            </div>
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
              isExporting={isExporting}
              generateNextPO={generateNextPO}
              onNavigate={setCurrentView}
            />
          )}

          {currentView === 'pos' && (
            <POManagement
              pos={pos}
              activePOId={activePOId}
              onSetActivePOId={setActivePOId}
              onUpdateStatus={updateStatus}
              onUpdateOrderInfo={updateOrderInfo}
              onExportPO={exportPO}
              onDeletePO={deletePO}
              isExporting={isExporting}
            />
          )}

          {currentView === 'unit_portal' && (
            <UnitPortalPage
              pos={pos}
              currentUser={currentUser}
              onNavigateToReceipt={handleNavigateToReceipt}
              onOpenPO={handleOpenPO}
            />
          )}

          {currentView === 'supplier_portal' && (
            <SupplierPortalPage
              pos={pos}
              currentUser={currentUser}
              onRefreshPOs={refreshPOs}
              preselectedPONumber={initialUrlParams.po}
              preselectedSupplierCode={initialUrlParams.supplier}
            />
          )}

          {currentView === 'receipt' && (
            <ReceiptConfirmationPage
              pos={pos}
              preselectedPOId={receiptPreselectedPOId}
              currentUser={currentUser}
              onRefreshPOs={refreshPOs}
              onNavigateToPO={handleOpenPO}
            />
          )}

          {currentView === 'deliveries' && (
            <DeliveryTrackingPage
              pos={pos}
              onOpenPO={handleOpenPO}
              onNavigateToReceipt={handleNavigateToReceipt}
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

      {/* Modal đăng nhập Quản trị dành cho https://quanlyts.com/admin */}
      <AdminLoginModal
        isOpen={showAdminLoginModal}
        onClose={() => setShowAdminLoginModal(false)}
        onSuccess={(user) => {
          if (refreshUser) refreshUser();
          setCurrentView('dashboard');
        }}
      />
    </div>
  );
}

export default App;
