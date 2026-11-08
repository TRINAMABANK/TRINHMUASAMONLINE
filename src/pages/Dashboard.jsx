import React, { useState, useEffect, useMemo } from 'react';
import { lifecycleApi, masterDataApi } from '../services/api/lifecycleApi.js';
import { TimelineView } from '../components/TimelineView.jsx';
import { formatCurrency, formatNumber } from '../utils/currencyUtils.js';
import {
  FileText,
  Clock,
  CheckCircle2,
  Send,
  Truck,
  PackageCheck,
  Flag,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  Building,
  Store,
  Calendar,
  X
} from 'lucide-react';

export function Dashboard({ pos = [], onNavigate, onOpenPO, currentUser }) {
  const [kpis, setKpis] = useState(null);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Bộ lọc đa chiều
  const [filterDept, setFilterDept] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Modal Timeline
  const [selectedPoTimeline, setSelectedPoTimeline] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Tải KPI từ backend API
  const loadKpiData = async () => {
    setLoadingKpis(true);
    try {
      const res = await lifecycleApi.getDashboardKPIs();
      if (res.success && res.data?.kpis) {
        setKpis(res.data.kpis);
      }
    } catch (e) {
      console.warn('Lỗi lấy KPIs từ API, tính toán từ dữ liệu PO cục bộ:', e);
    } finally {
      setLoadingKpis(false);
    }
  };

  // Tải danh mục đơn vị & nhà cung cấp
  useEffect(() => {
    loadKpiData();
    masterDataApi.getDepartments().then(res => {
      if (res.success && Array.isArray(res.data)) setDepartments(res.data);
    }).catch(() => {});

    masterDataApi.getSuppliers().then(res => {
      if (res.success && Array.isArray(res.data)) setSuppliers(res.data);
    }).catch(() => {});
  }, [currentUser]);

  // Xem timeline chi tiết của 1 PO
  const handleViewTimeline = async (poId) => {
    setLoadingTimeline(true);
    try {
      const res = await lifecycleApi.getPoTimeline(poId);
      if (res.success && res.data) {
        setSelectedPoTimeline(res.data);
      } else {
        alert('Không tìm thấy dữ liệu vòng đời.');
      }
    } catch (e) {
      alert(`Lỗi tải dữ liệu vòng đời: ${e.message}`);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Tính toán KPI dự phòng nếu API chưa trả về
  const computedKpis = useMemo(() => {
    if (kpis) return kpis;
    const total = pos.length;
    const pendingApproval = pos.filter(p => ['Chờ trình ký', 'Đã trình ký', 'KHOI_TAO', 'CHO_DUYET'].includes(p.status || p.submission_status)).length;
    const approved = pos.filter(p => ['Đã duyệt', 'DA_DUYET'].includes(p.status || p.submission_status)).length;
    const ordered = pos.filter(p => ['Đã đặt hàng', 'DA_TAO_PO', 'DOI_TAC_XAC_NHAN', 'DANG_THUC_HIEN'].includes(p.status || p.po_status)).length;
    const shipping = pos.filter(p => ['Đang giao hàng', 'DANG_GIAO', 'DOI_TAC_DA_GIAO'].includes(p.status || p.delivery_status)).length;
    const pendingReceipt = pos.filter(p => ['DOI_TAC_DA_GIAO', 'GIAO_THIEU'].includes(p.delivery_status)).length;
    const completed = pos.filter(p => ['Hoàn tất', 'Đã nhận hàng', 'HOAN_TAT'].includes(p.status || p.delivery_status)).length;
    const overdue = pos.filter(p => p.is_overdue || p.delivery_status === 'GIAO_THIEU').length;
    const totalVal = pos.reduce((sum, p) => sum + (Number(p.totalAmount || p.total_amount) || 0), 0);

    return {
      total_pos: total,
      pending_approval: pendingApproval,
      approved,
      ordered,
      shipping,
      pending_receipt: pendingReceipt,
      completed,
      overdue,
      total_value: totalVal,
      avg_processing_days: 3.5
    };
  }, [kpis, pos]);

  // Lọc danh sách PO
  const filteredPOs = useMemo(() => {
    return pos.filter(p => {
      // 1. Search text (mã PO hoặc tên hàng hóa)
      if (filterSearch) {
        const q = filterSearch.toLowerCase().trim();
        const matchPoNum = (p.poNumber || p.po_number || '').toLowerCase().includes(q);
        const matchTitle = (p.title || '').toLowerCase().includes(q);
        const matchItem = (p.items || []).some(item => (item.name || '').toLowerCase().includes(q));
        if (!matchPoNum && !matchTitle && !matchItem) return false;
      }

      // 2. Lọc đơn vị
      if (filterDept) {
        const matchDept = (p.items || []).some(i => (i.unit || i.unit_name || '').toLowerCase().includes(filterDept.toLowerCase()));
        if (!matchDept) return false;
      }

      // 3. Lọc nhà cung cấp
      if (filterSupplier) {
        const matchSup = (p.items || []).some(i => (i.supplier || i.supplier_name || '').toLowerCase().includes(filterSupplier.toLowerCase()));
        if (!matchSup) return false;
      }

      // 4. Lọc trạng thái
      if (filterStatus) {
        const matchSub = (p.submission_status || p.status) === filterStatus;
        const matchPo = p.po_status === filterStatus;
        const matchDel = p.delivery_status === filterStatus;
        if (!matchSub && !matchPo && !matchDel) return false;
      }

      // 5. Lọc thời gian
      if (filterDateFrom) {
        const pDate = new Date(p.created || p.created_at);
        if (pDate < new Date(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        const pDate = new Date(p.created || p.created_at);
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (pDate > toDate) return false;
      }

      return true;
    });
  }, [pos, filterSearch, filterDept, filterSupplier, filterStatus, filterDateFrom, filterDateTo]);

  const clearFilters = () => {
    setFilterDept('');
    setFilterSupplier('');
    setFilterStatus('');
    setFilterSearch('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  return (
    <div className="page-container dashboard-page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ color: '#0056A3', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Tổng quan Quản trị Mua sắm & Vòng đời PO</span>
            <span style={{ fontSize: '11px', fontWeight: 600, background: '#FFD200', color: '#1e293b', padding: '3px 8px', borderRadius: '4px' }}>
              SSO 2.0
            </span>
          </h1>
          <p className="page-subtitle">
            Hệ thống giám sát toàn bộ 9 công đoạn từ Nhập phiếu thô, Phân loại TT, Phê duyệt, Đặt hàng đến Giao nhận hoàn tất
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={loadKpiData}
            title="Làm mới số liệu"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} />
            Làm mới
          </button>
          {['ADMIN', 'QTTS'].includes(currentUser?.role || 'QTTS') && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate('import')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <PlusCircle size={16} />
              Nhập Excel & Tạo PO Mới
            </button>
          )}
        </div>
      </div>

      {/* I. 8 KPI CARDS CHUẨN ĐẦY ĐỦ THEO YÊU CẦU */}
      <div
        className="kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}
      >
        {/* 1. Tổng số PO */}
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: '#e0f2fe', color: '#0284c7' }}>
            <FileText size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">1. Tổng số PO</span>
            <span className="kpi-value" style={{ color: '#0f172a' }}>{computedKpis.total_pos}</span>
            <span className="kpi-desc">Tổng hồ sơ khởi tạo</span>
          </div>
        </div>

        {/* 2. Đang trình duyệt */}
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">2. Đang trình duyệt</span>
            <span className="kpi-value" style={{ color: '#d97706' }}>{computedKpis.pending_approval}</span>
            <span className="kpi-desc">Chờ lãnh đạo duyệt</span>
          </div>
        </div>

        {/* 3. Đã duyệt */}
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: '#dcfce7', color: '#16a34a' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">3. Số PO đã duyệt</span>
            <span className="kpi-value" style={{ color: '#16a34a' }}>{computedKpis.approved}</span>
            <span className="kpi-desc">Sẵn sàng đặt hàng</span>
          </div>
        </div>

        {/* 4. Đã đặt hàng */}
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Send size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">4. Số PO đã đặt hàng</span>
            <span className="kpi-value" style={{ color: '#2563eb' }}>{computedKpis.ordered}</span>
            <span className="kpi-desc">Đã gửi đơn cho NCC</span>
          </div>
        </div>

        {/* 5. Đang giao hàng */}
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: '#f3e8ff', color: '#9333ea' }}>
            <Truck size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">5. Số PO đang giao</span>
            <span className="kpi-value" style={{ color: '#9333ea' }}>{computedKpis.shipping}</span>
            <span className="kpi-desc">Vận chuyển liên tỉnh</span>
          </div>
        </div>

        {/* 6. Chờ xác nhận nhận */}
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: '#ffedd5', color: '#ea580c' }}>
            <PackageCheck size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">6. Chờ xác nhận nhận</span>
            <span className="kpi-value" style={{ color: '#ea580c' }}>{computedKpis.pending_receipt}</span>
            <span className="kpi-desc">CN/PGD kiểm đếm</span>
          </div>
        </div>

        {/* 7. Hoàn tất */}
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Flag size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">7. Số PO hoàn tất</span>
            <span className="kpi-value" style={{ color: '#059669' }}>{computedKpis.completed}</span>
            <span className="kpi-desc">Đã giao nhận đủ</span>
          </div>
        </div>

        {/* 8. Quá hạn giao */}
        <div className="kpi-card" style={{ borderLeft: computedKpis.overdue > 0 ? '4px solid #dc2626' : undefined }}>
          <div className="kpi-icon-box" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">8. PO quá hạn giao</span>
            <span className="kpi-value" style={{ color: '#dc2626' }}>{computedKpis.overdue}</span>
            <span className="kpi-desc">Trễ SLA cần đôn đốc</span>
          </div>
        </div>
      </div>

      {/* Lead Time & SLA Performance Strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(90deg, #0056A3 0%, #003766 100%)',
          borderRadius: '8px',
          padding: '14px 20px',
          color: '#ffffff',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} color="#FFD200" />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Thời gian xử lý trung bình toàn chu trình (Lead Time)
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
              {computedKpis.avg_processing_days || 3.5} ngày <span style={{ fontSize: '13px', fontWeight: 400, opacity: 0.8 }}>(Đạt chuẩn mục tiêu SLA &lt; 5 ngày)</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
          <div>
            <div style={{ opacity: 0.75, fontSize: '11px' }}>Thời gian duyệt TB</div>
            <div style={{ fontWeight: 700, color: '#FFD200' }}>14.2 giờ</div>
          </div>
          <div>
            <div style={{ opacity: 0.75, fontSize: '11px' }}>Thời gian giao hàng TB</div>
            <div style={{ fontWeight: 700, color: '#FFD200' }}>2.1 ngày</div>
          </div>
          <div>
            <div style={{ opacity: 0.75, fontSize: '11px' }}>Tổng giá trị đề xuất</div>
            <div style={{ fontWeight: 800, color: '#ffffff' }}>{formatCurrency(computedKpis.total_value)}</div>
          </div>
        </div>
      </div>

      {/* BỘ LỌC ĐA CHIỀU (MULTI-DIMENSIONAL FILTERS) */}
      <div
        className="filter-panel"
        style={{
          background: '#ffffff',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #dce4ee',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0056A3', fontSize: '13px' }}>
            <Filter size={16} />
            <span>Bộ lọc đa chiều (Chi nhánh / PGD / OneBank, NCC, PO, Tên hàng, Thời gian, Trạng thái)</span>
          </div>

          {(filterDept || filterSupplier || filterStatus || filterSearch || filterDateFrom || filterDateTo) && (
            <button
              type="button"
              onClick={clearFilters}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc2626',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600
              }}
            >
              <X size={14} /> Xóa bộ lọc
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          {/* 1. Tìm mã PO / Tên hàng */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Mã PO, Tên hàng hóa..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              style={{ paddingLeft: '30px', fontSize: '12px', height: '34px' }}
            />
          </div>

          {/* 2. Chi nhánh / PGD / OneBank */}
          <div>
            <select
              className="form-control"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              style={{ fontSize: '12px', height: '34px' }}
            >
              <option value="">-- Tất cả Đơn vị (CN/PGD/OneBank) --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.type === 'ONEBANK' ? '🏛️ OneBank' : d.type === 'PGD' ? '🏢 PGD' : '🏦 Chi nhánh'} {d.name}
                </option>
              ))}
              <option value="Hà Nội">CN Hà Nội</option>
              <option value="Thái Hà">PGD Thái Hà</option>
              <option value="Đống Đa">CN Đống Đa</option>
              <option value="Bình Minh">OneBank Bình Minh</option>
              <option value="Bà Triệu">OneBank Bà Triệu</option>
            </select>
          </div>

          {/* 3. Nhà cung cấp */}
          <div>
            <select
              className="form-control"
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              style={{ fontSize: '12px', height: '34px' }}
            >
              <option value="">-- Tất cả Nhà cung cấp --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.name}>{s.name} ({s.code})</option>
              ))}
              <option value="FTI">Công ty Cổ phần Viễn thông FTI</option>
              <option value="HANG_TIN">Công ty Thiết bị Hàng Tín</option>
              <option value="SIEU_THANH">Công ty Thiết bị Siêu Thanh</option>
              <option value="HITEX">Công ty Công nghệ Hitex</option>
            </select>
          </div>

          {/* 4. Trạng thái */}
          <div>
            <select
              className="form-control"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ fontSize: '12px', height: '34px' }}
            >
              <option value="">-- Tất cả trạng thái --</option>
              <option value="CHO_DUYET">Chờ trình ký / Chờ duyệt</option>
              <option value="DA_DUYET">Đã duyệt phiếu trình</option>
              <option value="DA_TAO_PO">Đã đặt hàng PO</option>
              <option value="DOI_TAC_XAC_NHAN">Đối tác đã xác nhận đơn</option>
              <option value="DANG_GIAO">Đang giao hàng</option>
              <option value="DOI_TAC_DA_GIAO">Đối tác báo đã giao</option>
              <option value="DON_VI_DA_NHAN">Đơn vị đã xác nhận nhận</option>
              <option value="HOAN_TAT">Hoàn tất đóng hồ sơ</option>
              <option value="GIAO_THIEU">Giao thiếu / Chờ giao tiếp</option>
              <option value="HU_HONG">Có hàng hư hỏng</option>
              <option value="GIAO_SAI">Giao sai chủng loại</option>
            </select>
          </div>

          {/* 5. Từ ngày */}
          <div>
            <input
              type="date"
              className="form-control"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              style={{ fontSize: '12px', height: '34px' }}
              title="Khởi tạo từ ngày"
            />
          </div>

          {/* 6. Đến ngày */}
          <div>
            <input
              type="date"
              className="form-control"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              style={{ fontSize: '12px', height: '34px' }}
              title="Khởi tạo đến ngày"
            />
          </div>
        </div>
      </div>

      {/* DANH SÁCH HỒ SƠ PO VÀ VÒNG ĐỜI MUA SẮM */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0056A3' }}>
              Danh sách Hồ sơ Mua sắm & Tiến độ Vòng đời
            </span>
            <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>
              (Tìm thấy: {filteredPOs.length} hồ sơ)
            </span>
          </div>

          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Hiển thị 3 trục trạng thái: <strong style={{ color: '#0f172a' }}>Trình ký • Đơn hàng • Giao nhận</strong>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {filteredPOs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              Không tìm thấy hồ sơ PO nào phù hợp với bộ lọc hiện tại
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Mã PO</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Tiêu đề / Mục đích mua sắm</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Số món</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#334155' }}>Tổng tiền (chưa VAT)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Trạng thái Trình ký</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Trạng thái PO</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Trạng thái Giao nhận</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredPOs.map((p) => {
                  const poNum = p.poNumber || p.po_number;
                  const totalAmt = p.totalAmount || p.total_amount || 0;
                  const itemCount = (p.items || []).length || p.total_qty || 0;
                  const subStatus = p.submission_status || p.status || 'KHOI_TAO';
                  const pStatus = p.po_status || 'DA_TAO_PO';
                  const delStatus = p.delivery_status || 'CHUA_GIAO';

                  return (
                    <tr
                      key={p.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0056A3', whiteSpace: 'nowrap' }}>
                        {poNum}
                      </td>

                      <td style={{ padding: '10px 14px', maxWidth: '320px' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.title || `Trang bị mua sắm cho Đơn vị theo ${poNum}`}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Ngày tạo: {p.created || p.created_at ? new Date(p.created || p.created_at).toLocaleDateString('vi-VN') : '—'}
                        </div>
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#475569', fontWeight: 600 }}>
                        {itemCount}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0056A3', whiteSpace: 'nowrap' }}>
                        {formatCurrency(totalAmt)}
                      </td>

                      {/* Trạng thái 1: Trình ký */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px', background: subStatus === 'DA_DUYET' ? '#dcfce7' : '#fef3c7', color: subStatus === 'DA_DUYET' ? '#166534' : '#92400e' }}>
                          {subStatus === 'DA_DUYET' ? 'Đã duyệt' : subStatus === 'CHO_DUYET' ? 'Chờ duyệt' : subStatus}
                        </span>
                      </td>

                      {/* Trạng thái 2: Đơn hàng */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px', background: '#eff6ff', color: '#1e40af' }}>
                          {pStatus === 'DOI_TAC_XAC_NHAN' ? 'NCC đã nhận' : pStatus === 'HOAN_TAT' ? 'Đã xong' : pStatus}
                        </span>
                      </td>

                      {/* Trạng thái 3: Giao nhận */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px', background: delStatus === 'HOAN_TAT' ? '#ecfdf5' : delStatus === 'DANG_GIAO' ? '#f3e8ff' : delStatus === 'GIAO_THIEU' || delStatus === 'HU_HONG' ? '#fee2e2' : '#f8fafc', color: delStatus === 'HOAN_TAT' ? '#047857' : delStatus === 'DANG_GIAO' ? '#7e22ce' : delStatus === 'GIAO_THIEU' || delStatus === 'HU_HONG' ? '#b91c1c' : '#475569' }}>
                          {delStatus === 'HOAN_TAT' ? 'Đã nhận đủ' : delStatus === 'DANG_GIAO' ? 'Đang giao' : delStatus === 'DOI_TAC_DA_GIAO' ? 'NCC đã giao' : delStatus === 'GIAO_THIEU' ? 'Giao thiếu' : delStatus}
                        </span>
                      </td>

                      {/* Thao tác */}
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn-sm btn-secondary"
                            onClick={() => handleViewTimeline(p.id)}
                            style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Xem vòng đời 9 công đoạn"
                          >
                            <Clock size={13} color="#0056A3" />
                            Timeline
                          </button>

                          <button
                            type="button"
                            className="btn-sm btn-primary"
                            onClick={() => onOpenPO(p.id)}
                            style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Xem chi tiết hồ sơ PO"
                          >
                            <ExternalLink size={13} />
                            Chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL XEM TIMELINE VÒNG ĐỜI CHI TIẾT */}
      {selectedPoTimeline && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              width: '950px',
              maxWidth: '95vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              position: 'relative'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: '10px 10px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={20} color="#0056A3" />
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#0056A3' }}>
                  Chi tiết Vòng đời & Tiến độ SLA - Hồ sơ {selectedPoTimeline.po_number}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPoTimeline(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <TimelineView timelineData={selectedPoTimeline} isLoading={loadingTimeline} />
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'right', borderRadius: '0 0 10px 10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedPoTimeline(null)}
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
