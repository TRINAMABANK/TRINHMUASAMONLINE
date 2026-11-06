import React, { useState } from 'react';
import { Dashboard } from './pages/Dashboard.jsx';
import { ImportPage } from './pages/ImportPage.jsx';
import { POManagement } from './pages/POManagement.jsx';
import { ExportPage } from './pages/ExportPage.jsx';
import { ReportPage } from './pages/ReportPage.jsx';
import { usePOManagement } from './hooks/usePOManagement.js';
import {
  LayoutDashboard,
  FileSpreadsheet,
  FolderKanban,
  FileDown,
  BarChart2,
  Building,
  Bell,
  UserCheck
} from 'lucide-react';
import './styles/main.css';

export function App() {
  const [currentView, setCurrentView] = useState('import'); // Mặc định vào quy trình nhập phiếu thô
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

  // Đếm số lượng hồ sơ cần phê duyệt
  const pendingCount = pos.filter(p => ['Chờ trình ký', 'Đã trình ký'].includes(p.status)).length;

  // Điều hướng và mở modal PO
  const handleOpenPO = (id) => {
    setActivePOId(id);
    setCurrentView('pos');
  };

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
          <button
            type="button"
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            <LayoutDashboard size={18} />
            Tổng quan (Dashboard)
          </button>

          <button
            type="button"
            className={`nav-item ${currentView === 'import' ? 'active' : ''}`}
            onClick={() => setCurrentView('import')}
          >
            <FileSpreadsheet size={18} />
            Nhập Phiếu & Tạo PO
          </button>

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

          <button
            type="button"
            className={`nav-item ${currentView === 'exports' ? 'active' : ''}`}
            onClick={() => setCurrentView('exports')}
          >
            <FileDown size={18} />
            Xuất 2 Mẫu Excel
          </button>

          <button
            type="button"
            className={`nav-item ${currentView === 'reports' ? 'active' : ''}`}
            onClick={() => setCurrentView('reports')}
          >
            <BarChart2 size={18} />
            Báo cáo & Thống kê
          </button>
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
            <span className="text-muted text-xs">Mẫu: 1. Bảng Trình Ký (PYC) • 2. Bảng Kê (10 cột)</span>
          </div>

          <div className="topbar-right">
            <div className="flex-align gap-2">
              <UserCheck size={16} className="text-muted" />
              <span className="font-medium text-navy" style={{ fontSize: 13 }}>Cán bộ Nam A Bank</span>
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

          {currentView === 'exports' && (
            <ExportPage
              pos={pos}
              onExportPO={exportPO}
              isExporting={isExporting}
            />
          )}

          {currentView === 'reports' && (
            <ReportPage
              pos={pos}
              onSeedDemo={seedDemoData}
              onRefresh={refreshPOs}
            />
          )}
        </div>
      </main>
    </div>
  );
}
export default App;
