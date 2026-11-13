import React, { useState, useMemo } from 'react';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { OrderEmailModal } from '../components/OrderEmailModal.jsx';
import { SupplierOrderManagementSection } from '../components/SupplierOrderManagementSection.jsx';
import { formatCurrency, formatNumber } from '../utils/currencyUtils.js';
import { formatExcelDate, todayYMD } from '../utils/dateUtils.js';
import { calculatePOTimings } from '../utils/timingUtils.js';
import { WORKFLOW_STAGES } from '../utils/constants.js';
import { normalizeText } from '../utils/validation.js';
import {
  Search,
  Filter,
  FileDown,
  Trash2,
  ExternalLink,
  X,
  Clock,
  CheckCircle,
  CheckCircle2,
  Truck,
  AlertOctagon,
  Calendar,
  User,
  Building,
  Building2,
  FileText,
  Mail,
  Store,
  PackageCheck,
  ShieldCheck,
  FolderKanban,
  Send,
  RotateCcw,
  ListFilter,
  Layers,
  History,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';

export function POManagement({
  pos = [],
  activePOId,
  onSetActivePOId,
  onUpdateStatus,
  onUpdateOrderInfo,
  onExportPO,
  onDeletePO,
  isExporting,
  currentUser,
  refreshPOs
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Tab đang kích hoạt trong Modal chi tiết PO (mặc định Tab A)
  const [activeTab, setActiveTab] = useState('overview');

  // Lọc và tìm kiếm PO đa tiêu chí
  const filteredPOs = useMemo(() => {
    const q = normalizeText(searchTerm);
    return pos.filter(p => {
      // 1. Lọc theo trạng thái
      if (statusFilter) {
        if (statusFilter === 'Chờ trình ký' && !['Chờ trình ký', 'KHOI_TAO', 'CHO_TRINH_KY'].includes(p.status) && p.submission_status !== 'KHOI_TAO') return false;
        if (statusFilter === 'Đang trình ký' && !['Đang trình ký', 'DANG_TRINH_KY', 'CHO_DUYET'].includes(p.status) && p.submission_status !== 'DANG_TRINH_KY') return false;
        if (statusFilter === 'Đã duyệt' && p.status !== 'Đã duyệt' && p.submission_status !== 'DA_DUYET') return false;
        if (statusFilter === 'Đã đặt hàng' && p.status !== 'Đã đặt hàng' && p.po_status !== 'DA_DAT_HANG') return false;
        if (statusFilter === 'Đang giao hàng' && p.status !== 'Đang giao hàng' && p.delivery_status !== 'DANG_GIAO') return false;
        if (statusFilter === 'Chờ đơn vị xác nhận' && p.status !== 'Chờ đơn vị xác nhận' && p.delivery_status !== 'DA_NHAN_MOT_PHAN') return false;
        if (statusFilter === 'Hoàn tất' && p.status !== 'Hoàn tất' && p.delivery_status !== 'HOAN_TAT' && p.po_status !== 'HOAN_TAT') return false;
        if (statusFilter === 'Từ chối' && p.status !== 'Từ chối' && p.submission_status !== 'TU_CHOI') return false;
      }

      // 2. Lọc theo khoảng thời gian
      if (fromDate) {
        const poDate = p.date ? new Date(p.date) : (p.created ? new Date(p.created) : null);
        if (poDate && poDate < new Date(fromDate)) return false;
      }
      if (toDate) {
        const poDate = p.date ? new Date(p.date) : (p.created ? new Date(p.created) : null);
        if (poDate && poDate > new Date(toDate + 'T23:59:59')) return false;
      }

      // 3. Tìm kiếm theo từ khóa (Mã PO, Người đề xuất, Tên đơn vị, Tên hàng, NCC)
      if (q) {
        const itemNames = (p.items || []).map(x => `${x.unit} ${x.item} ${x.supplier} ${x.msp}`).join(' ');
        const full = normalizeText(`${p.po} ${p.po_number || ''} ${p.requester} ${p.representative_unit || ''} ${p.note} ${itemNames}`);
        if (!full.includes(q)) return false;
      }

      return true;
    });
  }, [pos, searchTerm, statusFilter, fromDate, toDate]);

  // Đếm các trạng thái cho 8 Thẻ Dashboard Tổng quan Admin
  const stats = useMemo(() => {
    let pendingSubmission = 0;
    let submitting = 0;
    let approved = 0;
    let ordered = 0;
    let delivering = 0;
    let waitingConfirm = 0;
    let completed = 0;

    for (const p of pos) {
      if (p.delivery_status === 'HOAN_TAT' || p.po_status === 'HOAN_TAT' || p.status === 'Hoàn tất') {
        completed++;
      } else if (p.delivery_status === 'DA_NHAN_MOT_PHAN' || p.status === 'Chờ đơn vị xác nhận') {
        waitingConfirm++;
      } else if (p.delivery_status === 'DANG_GIAO' || p.status === 'Đang giao hàng') {
        delivering++;
      } else if (p.po_status === 'DA_DAT_HANG' || p.status === 'Đã đặt hàng') {
        ordered++;
      } else if (p.submission_status === 'DA_DUYET' || p.status === 'Đã duyệt') {
        approved++;
      } else if (p.submission_status === 'DANG_TRINH_KY' || p.status === 'Đang trình ký') {
        submitting++;
      } else {
        pendingSubmission++;
      }
    }

    return {
      total: pos.length,
      pendingSubmission,
      submitting,
      approved,
      ordered,
      delivering,
      waitingConfirm,
      completed
    };
  }, [pos]);

  const activePO = pos.find(p => p.id === activePOId) || null;

  // State cho form đặt hàng / giao hàng / nhận hàng
  const [orderSupplier, setOrderSupplier] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [receivedQtyInput, setReceivedQtyInput] = useState(0);

  // Form giao hàng mới
  const [newCarrier, setNewCarrier] = useState('');
  const [newTracking, setNewTracking] = useState('');
  const [newDeliveryNote, setNewDeliveryNote] = useState('');

  // Form biên bản nhận hàng mới
  const [receiptConditionNote, setReceiptConditionNote] = useState('');
  const [receiptReceiverName, setReceiptReceiverName] = useState('');

  // State cho modal soạn email đặt hàng
  const [emailModalPO, setEmailModalPO] = useState(null);

  // Mở modal chi tiết PO
  const handleOpenModal = (po, initialTab = 'overview') => {
    onSetActivePOId(po.id);
    setActiveTab(initialTab);
    setOrderSupplier(po.orderSupplier || po.items?.[0]?.supplier || '');
    setOrderNo(po.orderNo || '');
    setOrderDate(po.orderDate || todayYMD());
    setReceivedQtyInput(po.receivedQty || 0);
  };

  const handleCloseModal = () => {
    onSetActivePOId(null);
  };

  // Xác nhận gửi email đặt hàng
  const handleConfirmOrderEmailSent = async ({ poId, poNumber, supplierCode, supplierName, recipientEmail }) => {
    const targetPO = pos.find(p => p.id === poId) || activePO;
    const newLog = {
      time: new Date().toLocaleString('vi-VN'),
      text: `Đã gửi Email đặt hàng cho NCC ${supplierName} (${recipientEmail}) kèm đơn PO_NAMABANK_${poNumber}_${supplierCode}.xlsx`
    };

    await onUpdateOrderInfo(poId, {
      status: 'Đã đặt hàng',
      orderSupplier: supplierName,
      orderSupplierCode: supplierCode,
      recipientEmail,
      orderDate: todayYMD(),
      logs: [
        ...(targetPO?.logs || []),
        newLog
      ]
    });
  };

  // Tính toán thời gian và chỉ số của activePO
  const activePOTimings = useMemo(() => {
    if (!activePO) return {};
    return calculatePOTimings(activePO);
  }, [activePO]);

  const activePOTotalQty = activePO ? (activePO.items || []).reduce((s, x) => s + (Number(x.qty) || 0), 0) : 0;
  const activePOTotalAmount = activePO ? (activePO.items || []).reduce((s, x) => s + (Number(x.amount) || 0), 0) : 0;
  const activePOHoiSoAmount = activePO ? (activePO.items || []).filter(x => x.payGroup === 'HOI_SO' || x.payGroup === 'A').reduce((s, x) => s + (Number(x.amount) || 0), 0) : 0;
  const activePODonViAmount = activePO ? (activePO.items || []).filter(x => x.payGroup === 'DON_VI' || x.payGroup === 'B').reduce((s, x) => s + (Number(x.amount) || 0), 0) : 0;

  // Xử lý gửi trình ký
  const handleActionSubmitApproval = async () => {
    if (!activePO) return;
    await onUpdateStatus(activePO.id, 'Đang trình ký');
  };

  // Xử lý duyệt hồ sơ
  const handleActionApprove = async () => {
    if (!activePO) return;
    const comment = prompt('Ý kiến chỉ đạo / Ghi chú phê duyệt (Tùy chọn):', 'Đồng ý phê duyệt mua sắm theo tờ trình');
    await onUpdateStatus(activePO.id, 'Đã duyệt', comment || 'Đã phê duyệt');
  };

  // Xử lý từ chối
  const handleActionReject = async () => {
    if (!activePO) return;
    const reason = prompt('Lý do từ chối / Trả lại hồ sơ yêu cầu rà soát:');
    if (!reason) return;
    await onUpdateStatus(activePO.id, 'Từ chối', reason);
  };

  // Xử lý đặt hàng
  const handleActionOrder = async () => {
    if (!activePO) return;
    await onUpdateOrderInfo(activePO.id, {
      status: 'Đã đặt hàng',
      orderSupplier: orderSupplier || activePO.items?.[0]?.supplier || 'NCC',
      orderNo: orderNo || '',
      orderDate: orderDate || todayYMD()
    });
  };

  // Xử lý giao hàng
  const handleActionDeliver = async () => {
    if (!activePO) return;
    await onUpdateStatus(activePO.id, 'Đang giao hàng', `${newCarrier || 'Đơn vị vận chuyển'} - Vận đơn: ${newTracking || 'Chưa có'}`);
    setNewCarrier('');
    setNewTracking('');
    setNewDeliveryNote('');
  };

  // Xử lý nhận hàng
  const handleActionReceipt = async () => {
    if (!activePO) return;
    await onUpdateOrderInfo(activePO.id, {
      receivedQty: receivedQtyInput || activePOTotalQty,
      status: (receivedQtyInput >= activePOTotalQty) ? 'Hoàn tất' : 'Chờ đơn vị xác nhận'
    });
  };

  // Reset toàn bộ bộ lọc
  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="page-container po-management-page">
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">Hồ Sơ PO & Trung Tâm Quản Lý Vòng Đời</h1>
          <p className="page-subtitle">Quản lý tổng thể vòng đời PO từ trình ký, phê duyệt, đặt hàng, NCC, giao nhận đến đối soát thời gian xử lý</p>
        </div>
      </div>

      {/* 1. DASHBOARD TỔNG QUAN ADMIN: 8 THẺ CHỈ SỐ TƯƠNG TÁC (SECTION II.1) */}
      <div className="admin-po-dashboard-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        {/* Thẻ 1: Tổng số PO */}
        <div
          onClick={() => setStatusFilter('')}
          className={`summary-card-clickable ${statusFilter === '' ? 'active-filter-card' : ''}`}
          style={{
            background: '#ffffff',
            border: statusFilter === '' ? '2px solid #0056A3' : '1px solid #dce4ee',
            borderRadius: '8px',
            padding: '12px 14px',
            cursor: 'pointer',
            boxShadow: statusFilter === '' ? '0 4px 12px rgba(0,86,163,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>TỔNG PO</span>
            <FolderKanban size={16} color="#0056A3" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0056A3', lineHeight: 1 }}>{stats.total}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Tất cả hồ sơ</div>
        </div>

        {/* Thẻ 2: Chờ trình ký */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Chờ trình ký' ? '' : 'Chờ trình ký')}
          className={`summary-card-clickable ${statusFilter === 'Chờ trình ký' ? 'active-filter-card' : ''}`}
          style={{
            background: '#ffffff',
            border: statusFilter === 'Chờ trình ký' ? '2px solid #64748b' : '1px solid #dce4ee',
            borderRadius: '8px',
            padding: '12px 14px',
            cursor: 'pointer',
            boxShadow: statusFilter === 'Chờ trình ký' ? '0 4px 12px rgba(100,116,139,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>CHỜ TRÌNH</span>
            <Clock size={16} color="#64748b" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#334155', lineHeight: 1 }}>{stats.pendingSubmission}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Chưa gửi lãnh đạo</div>
        </div>

        {/* Thẻ 3: Đang trình ký */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Đang trình ký' ? '' : 'Đang trình ký')}
          className={`summary-card-clickable ${statusFilter === 'Đang trình ký' ? 'active-filter-card' : ''}`}
          style={{
            background: '#ffffff',
            border: statusFilter === 'Đang trình ký' ? '2px solid #0284c7' : '1px solid #dce4ee',
            borderRadius: '8px',
            padding: '12px 14px',
            cursor: 'pointer',
            boxShadow: statusFilter === 'Đang trình ký' ? '0 4px 12px rgba(2,132,199,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>ĐANG TRÌNH</span>
            <FileText size={16} color="#0284c7" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284c7', lineHeight: 1 }}>{stats.submitting}</div>
          <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px' }}>Đang chờ duyệt</div>
        </div>

        {/* Thẻ 4: Đã duyệt */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Đã duyệt' ? '' : 'Đã duyệt')}
          className={`summary-card-clickable ${statusFilter === 'Đã duyệt' ? 'active-filter-card' : ''}`}
          style={{
            background: '#ffffff',
            border: statusFilter === 'Đã duyệt' ? '2px solid #16a34a' : '1px solid #dce4ee',
            borderRadius: '8px',
            padding: '12px 14px',
            cursor: 'pointer',
            boxShadow: statusFilter === 'Đã duyệt' ? '0 4px 12px rgba(22,163,74,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>ĐÃ DUYỆT</span>
            <CheckCircle2 size={16} color="#16a34a" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{stats.approved}</div>
          <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>Chờ đặt hàng NCC</div>
        </div>

        {/* Thẻ 5: Đã đặt hàng */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Đã đặt hàng' ? '' : 'Đã đặt hàng')}
          className={`summary-card-clickable ${statusFilter === 'Đã đặt hàng' ? 'active-filter-card' : ''}`}
          style={{
            background: '#ffffff',
            border: statusFilter === 'Đã đặt hàng' ? '2px solid #0056A3' : '1px solid #dce4ee',
            borderRadius: '8px',
            padding: '12px 14px',
            cursor: 'pointer',
            boxShadow: statusFilter === 'Đã đặt hàng' ? '0 4px 12px rgba(0,86,163,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#0056A3', textTransform: 'uppercase' }}>ĐÃ ĐẶT HÀNG</span>
            <Store size={16} color="#0056A3" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0056A3', lineHeight: 1 }}>{stats.ordered}</div>
          <div style={{ fontSize: '11px', color: '#0056A3', marginTop: '4px' }}>Đã gửi đơn NCC</div>
        </div>

        {/* Thẻ 6: Đang giao hàng */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Đang giao hàng' ? '' : 'Đang giao hàng')}
          className={`summary-card-clickable ${statusFilter === 'Đang giao hàng' ? 'active-filter-card' : ''}`}
          style={{
            background: '#ffffff',
            border: statusFilter === 'Đang giao hàng' ? '2px solid #d97706' : '1px solid #dce4ee',
            borderRadius: '8px',
            padding: '12px 14px',
            cursor: 'pointer',
            boxShadow: statusFilter === 'Đang giao hàng' ? '0 4px 12px rgba(217,119,6,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>ĐANG GIAO</span>
            <Truck size={16} color="#d97706" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{stats.delivering}</div>
          <div style={{ fontSize: '11px', color: '#d97706', marginTop: '4px' }}>Vận chuyển về ĐV</div>
        </div>

        {/* Thẻ 7: Chờ đơn vị xác nhận */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Chờ đơn vị xác nhận' ? '' : 'Chờ đơn vị xác nhận')}
          className={`summary-card-clickable ${statusFilter === 'Chờ đơn vị xác nhận' ? 'active-filter-card' : ''}`}
          style={{
            background: '#ffffff',
            border: statusFilter === 'Chờ đơn vị xác nhận' ? '2px solid #8b5cf6' : '1px solid #dce4ee',
            borderRadius: '8px',
            padding: '12px 14px',
            cursor: 'pointer',
            boxShadow: statusFilter === 'Chờ đơn vị xác nhận' ? '0 4px 12px rgba(139,92,246,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase' }}>CHỜ ĐV NHẬN</span>
            <PackageCheck size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#8b5cf6', lineHeight: 1 }}>{stats.waitingConfirm}</div>
          <div style={{ fontSize: '11px', color: '#8b5cf6', marginTop: '4px' }}>ĐV chưa xác nhận</div>
        </div>

        {/* Thẻ 8: Hoàn tất */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'Hoàn tất' ? '' : 'Hoàn tất')}
          className={`summary-card-clickable ${statusFilter === 'Hoàn tất' ? 'active-filter-card' : ''}`}
          style={{
            background: '#ffffff',
            border: statusFilter === 'Hoàn tất' ? '2px solid #15803d' : '1px solid #dce4ee',
            borderRadius: '8px',
            padding: '12px 14px',
            cursor: 'pointer',
            boxShadow: statusFilter === 'Hoàn tất' ? '0 4px 12px rgba(21,128,61,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>HOÀN TẤT</span>
            <ShieldCheck size={16} color="#15803d" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#15803d', lineHeight: 1 }}>{stats.completed}</div>
          <div style={{ fontSize: '11px', color: '#15803d', marginTop: '4px' }}>Đã nghiệm thu 100%</div>
        </div>
      </div>

      {/* 2. BỘ LỌC VÀ TÌM KIẾM ĐA TIÊU CHÍ (SECTION II.2) */}
      <div className="table-filter-bar" style={{
        background: '#ffffff',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid #dce4ee',
        marginBottom: '16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        {/* Ô tìm kiếm từ khóa tổng hợp */}
        <div className="search-box" style={{ flex: '1 1 300px', minWidth: '260px' }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Tìm theo mã PO, người đề xuất, tên đơn vị, tên hàng hóa, nhà cung cấp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Nhóm lọc Dropdown & Date Range */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          {/* Dropdown Trạng thái */}
          <div className="filter-select-wrapper">
            <Filter size={14} className="filter-icon" />
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái ({pos.length})</option>
              <option value="Chờ trình ký">Chờ trình ký</option>
              <option value="Đang trình ký">Đang trình ký</option>
              <option value="Đã duyệt">Đã duyệt</option>
              <option value="Đã đặt hàng">Đã đặt hàng</option>
              <option value="Đang giao hàng">Đang giao hàng</option>
              <option value="Chờ đơn vị xác nhận">Chờ đơn vị xác nhận</option>
              <option value="Hoàn tất">Hoàn tất</option>
              <option value="Từ chối">Từ chối / Trả lại</option>
            </select>
          </div>

          {/* Khoảng thời gian: Từ ngày */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Từ:</span>
            <input
              type="date"
              className="form-input"
              style={{ padding: '6px 10px', fontSize: '12.5px', height: '36px' }}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          {/* Khoảng thời gian: Đến ngày */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Đến:</span>
            <input
              type="date"
              className="form-input"
              style={{ padding: '6px 10px', fontSize: '12.5px', height: '36px' }}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          {/* Nút Đặt lại bộ lọc */}
          {(searchTerm || statusFilter || fromDate || toDate) && (
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12.5px', height: '36px' }}
              onClick={handleResetFilters}
              title="Đặt lại toàn bộ điều kiện lọc"
            >
              <RotateCcw size={14} />
              <span>Đặt lại</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. BẢNG QUẢN LÝ TỔNG PO: ĐÚNG 13 CỘT QUY ĐỊNH (SECTION II.2) */}
      <div className="content-card" style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', overflow: 'hidden' }}>
        {filteredPOs.length === 0 ? (
          <div className="empty-state-box" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <FileText size={48} className="text-muted" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600, color: '#475569' }}>Không tìm thấy hồ sơ PO nào phù hợp với điều kiện tìm kiếm.</p>
            <p style={{ fontSize: '13px', color: '#94a3b8' }}>Hãy thử điều chỉnh từ khóa tìm kiếm hoặc chọn "Tất cả trạng thái".</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="procurement-table" style={{ width: '100%', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #dce4ee' }}>
                  <th style={{ minWidth: '130px' }}>1. Mã PO</th>
                  <th style={{ minWidth: '95px' }}>2. Ngày lập PO</th>
                  <th style={{ minWidth: '120px' }}>3. Người đề xuất</th>
                  <th style={{ minWidth: '130px' }}>4. Đơn vị đại diện</th>
                  <th style={{ minWidth: '70px', textAlign: 'center' }}>5. Số SP</th>
                  <th style={{ minWidth: '130px', textAlign: 'right' }}>6. Tổng giá trị (chưa VAT)</th>
                  <th style={{ minWidth: '100px' }}>7. Ngày gửi trình</th>
                  <th style={{ minWidth: '100px' }}>8. Ngày hoàn tất trình</th>
                  <th style={{ minWidth: '110px' }}>9. Thời gian trình ký</th>
                  <th style={{ minWidth: '115px' }}>10. TT Trình ký</th>
                  <th style={{ minWidth: '110px' }}>11. TT Đặt hàng</th>
                  <th style={{ minWidth: '115px' }}>12. TT Giao nhận</th>
                  <th style={{ minWidth: '140px', textAlign: 'center' }}>13. Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredPOs.map((po) => {
                  const poTotal = (po.items || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
                  const repUnit = po.representative_unit || po.items?.[0]?.unit || 'Hội sở';
                  const timings = po.timings || calculatePOTimings(po);

                  // Cột 10: Trạng thái trình ký
                  let subBadge = { text: 'Chờ trình', bg: '#f1f5f9', color: '#475569' };
                  if (po.submission_status === 'DA_DUYET') {
                    subBadge = { text: 'Đã duyệt', bg: '#dcfce7', color: '#166534' };
                  } else if (po.submission_status === 'TU_CHOI') {
                    subBadge = { text: 'Từ chối', bg: '#fee2e2', color: '#991b1b' };
                  } else if (po.submission_status === 'DANG_TRINH_KY') {
                    subBadge = { text: 'Đang trình', bg: '#e0f2fe', color: '#075985' };
                  }

                  // Cột 11: Trạng thái đặt hàng
                  let ordBadge = { text: 'Chưa đặt', bg: '#f1f5f9', color: '#64748b' };
                  if (po.po_status === 'DA_DAT_HANG' || po.status === 'Đã đặt hàng') {
                    ordBadge = { text: 'Đã đặt hàng', bg: '#eff6ff', color: '#1d4ed8' };
                  } else if (po.po_status === 'HOAN_TAT') {
                    ordBadge = { text: 'Đã đặt hàng', bg: '#eff6ff', color: '#1d4ed8' };
                  }

                  // Cột 12: Trạng thái giao nhận
                  let delBadge = { text: 'Chưa giao', bg: '#f1f5f9', color: '#64748b' };
                  if (po.delivery_status === 'HOAN_TAT' || po.status === 'Hoàn tất') {
                    delBadge = { text: 'Đã nhận đủ', bg: '#dcfce7', color: '#166534' };
                  } else if (po.delivery_status === 'DA_NHAN_MOT_PHAN' || po.status === 'Chờ đơn vị xác nhận') {
                    delBadge = { text: 'Chờ xác nhận', bg: '#fef3c7', color: '#92400e' };
                  } else if (po.delivery_status === 'DANG_GIAO' || po.status === 'Đang giao hàng') {
                    delBadge = { text: 'Đang giao', bg: '#ffedd5', color: '#c2410c' };
                  }

                  return (
                    <tr key={po.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                      {/* 1. Mã PO */}
                      <td style={{ fontWeight: 700 }}>
                        <button
                          type="button"
                          onClick={() => handleOpenModal(po, 'overview')}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#0056A3',
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                          title="Bấm để xem hồ sơ chi tiết 9 tabs"
                        >
                          {po.po}
                        </button>
                      </td>

                      {/* 2. Ngày lập PO */}
                      <td>{formatExcelDate(po.date)}</td>

                      {/* 3. Người đề xuất */}
                      <td style={{ color: '#334155' }}>{po.requester || '—'}</td>

                      {/* 4. Đơn vị đại diện */}
                      <td style={{ fontWeight: 500, color: '#1e293b' }}>{repUnit}</td>

                      {/* 5. Số sản phẩm */}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#0056A3' }}>
                        {po.items?.length || 0}
                      </td>

                      {/* 6. Tổng giá trị chưa VAT */}
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0056A3' }}>
                        {formatCurrency(poTotal)}
                      </td>

                      {/* 7. Ngày gửi trình ký */}
                      <td style={{ color: '#475569' }}>
                        {po.submitted_at ? formatExcelDate(po.submitted_at) : '—'}
                      </td>

                      {/* 8. Ngày hoàn tất trình ký */}
                      <td style={{ color: po.approved_at ? '#166534' : '#64748b' }}>
                        {po.approved_at ? formatExcelDate(po.approved_at) : '—'}
                      </td>

                      {/* 9. Thời gian trình ký (tính chính xác Section III) */}
                      <td style={{ fontWeight: 600, color: timings.approvalDurationMs ? '#0056A3' : '#64748b' }}>
                        {timings.approvalDurationText || '—'}
                      </td>

                      {/* 10. Trạng thái trình ký */}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: subBadge.bg,
                          color: subBadge.color
                        }}>
                          {subBadge.text}
                        </span>
                      </td>

                      {/* 11. Trạng thái đặt hàng */}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: ordBadge.bg,
                          color: ordBadge.color
                        }}>
                          {ordBadge.text}
                        </span>
                      </td>

                      {/* 12. Trạng thái giao nhận */}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: delBadge.bg,
                          color: delBadge.color
                        }}>
                          {delBadge.text}
                        </span>
                      </td>

                      {/* 13. Thao tác */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-table-action"
                            style={{ padding: '4px 8px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
                            onClick={() => handleOpenModal(po, 'overview')}
                            title="Mở bảng điều khiển 9 Tab của PO"
                          >
                            Chi tiết
                            <ExternalLink size={12} style={{ marginLeft: 3 }} />
                          </button>

                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => setEmailModalPO(po)}
                            title="Tạo & Gửi Email Đặt Hàng NCC"
                            style={{ color: '#0056A3', background: '#eff6ff', borderColor: '#bfdbfe', width: '28px', height: '28px' }}
                          >
                            <Mail size={14} />
                          </button>

                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => onExportPO(po.id)}
                            title="Tải 01 file Excel gồm 02 Sheet (1. Phiếu trình & 2. Bảng kê)"
                            disabled={isExporting}
                            style={{ width: '28px', height: '28px' }}
                          >
                            <FileDown size={14} />
                          </button>

                          <button
                            type="button"
                            className="btn-icon btn-icon-danger"
                            onClick={() => {
                              if (confirm(`Bạn có chắc chắn muốn xóa hồ sơ ${po.po}? Thao tác này sẽ xóa toàn bộ các dòng hàng thuộc PO.`)) {
                                onDeletePO(po.id);
                              }
                            }}
                            title="Xóa hồ sơ"
                            style={{ width: '28px', height: '28px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. MÀN HÌNH CHI TIẾT PO CHUẨN 9 TAB (SECTION II.3: TAB A ĐẾN TAB I) */}
      {activePO && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div
            className="modal-dialog"
            style={{
              maxWidth: '1100px',
              width: '95vw',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px 24px',
              background: '#0056A3',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '2px solid #FFD200'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: '#FFD200',
                  color: '#1e293b',
                  fontWeight: 800,
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}>
                  MASTER PO
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                    Hồ Sơ PO: {activePO.po}
                  </h3>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>
                    Đơn vị: {activePO.representative_unit || 'Hội sở'} • {activePO.items?.length || 0} sản phẩm • {formatCurrency(activePOTotalAmount)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <StatusBadge status={activePO.status} />
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: 'none',
                    color: '#ffffff',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Tab Navigation: ĐÚNG 9 TABS QUY ĐỊNH (A -> I) */}
            <div style={{
              display: 'flex',
              background: '#f8fafc',
              borderBottom: '1px solid #dce4ee',
              padding: '0 16px',
              overflowX: 'auto'
            }}>
              {[
                { id: 'overview', label: 'A. Tổng quan PO', icon: FolderKanban },
                { id: 'items', label: `B. Dữ liệu hàng hóa (${activePO.items?.length || 0})`, icon: Layers },
                { id: 'sheet', label: 'C. Phiếu trình & Bảng kê', icon: FileSpreadsheet },
                { id: 'approvals', label: 'D. Lịch sử phê duyệt', icon: CheckCircle2 },
                { id: 'suppliers', label: `E. NCC & Đơn hàng (${activePO.suppliers?.length || 1})`, icon: Store },
                { id: 'emails', label: `F. Email đã gửi (${activePO.email_logs?.length || 0})`, icon: Mail },
                { id: 'deliveries', label: `G. Tiến độ giao hàng (${activePO.deliveries?.length || 0})`, icon: Truck },
                { id: 'receipts', label: `H. Xác nhận nhận hàng (${activePO.receipts?.length || 0})`, icon: PackageCheck },
                { id: 'logs', label: 'I. Lịch sử hoạt động', icon: History }
              ].map(tab => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '12px 14px',
                      fontSize: '12.5px',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#0056A3' : '#64748b',
                      background: 'none',
                      border: 'none',
                      borderBottom: isSelected ? '3px solid #0056A3' : '3px solid transparent',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Icon size={14} color={isSelected ? '#0056A3' : '#64748b'} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              {/* TAB A: TỔNG QUAN PO & TIẾN TRÌNH VÒNG ĐỜI (SECTION II.3.A & SECTION III) */}
              {activeTab === 'overview' && (
                <div>
                  {/* Visual Pipeline Tracker Vòng Đời Mua Sắm */}
                  <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #dce4ee', marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '12px' }}>
                      TIẾN TRÌNH VÒNG ĐỜI HỒ SƠ (PROCUREMENT PIPELINE)
                    </div>
                    <div className="workflow-step-track">
                      {[
                        { title: 'Upload Excel', key: 'UPLOAD', done: true },
                        { title: 'Phân nhóm', key: 'PHAN_NHOM', done: true },
                        { title: 'Trình ký', key: 'TRINH_KY', done: ['Đang trình ký', 'Đã duyệt', 'Đã đặt hàng', 'Đang giao hàng', 'Chờ đơn vị xác nhận', 'Hoàn tất'].includes(activePO.status) },
                        { title: 'Phê duyệt', key: 'PHE_DUYET', done: ['Đã duyệt', 'Đã đặt hàng', 'Đang giao hàng', 'Chờ đơn vị xác nhận', 'Hoàn tất'].includes(activePO.status) },
                        { title: 'Đặt hàng NCC', key: 'DAT_HANG', done: ['Đã đặt hàng', 'Đang giao hàng', 'Chờ đơn vị xác nhận', 'Hoàn tất'].includes(activePO.status) },
                        { title: 'Giao hàng', key: 'GIAO_HANG', done: ['Đang giao hàng', 'Chờ đơn vị xác nhận', 'Hoàn tất'].includes(activePO.status) },
                        { title: 'Đơn vị nhận', key: 'DON_VI_NHAN', done: ['Chờ đơn vị xác nhận', 'Hoàn tất'].includes(activePO.status) },
                        { title: 'Hoàn tất', key: 'HOAN_TAT', done: activePO.status === 'Hoàn tất' }
                      ].map((st, i) => (
                        <div key={st.key} className={`timeline-node ${st.done ? 'done' : ''}`}>
                          <div className="node-circle">{st.done ? <CheckCircle size={13} /> : i + 1}</div>
                          <span className="node-label" style={{ fontSize: '11px' }}>{st.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Thông tin hồ sơ cơ bản */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #dce4ee' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>NGÀY TẠO HỒ SƠ</span>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                        {formatExcelDate(activePO.date)}
                      </div>
                    </div>

                    <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #dce4ee' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>NGƯỜI ĐỀ XUẤT</span>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                        {activePO.requester || 'Chưa nhập'}
                      </div>
                    </div>

                    <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #dce4ee' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>ĐƠN VỊ ĐẠI DIỆN</span>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0056A3', marginTop: '2px' }}>
                        {activePO.representative_unit || 'Hội sở'}
                      </div>
                    </div>

                    <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #dce4ee' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TỔNG GIÁ TRỊ CHƯA VAT</span>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0056A3', marginTop: '2px' }}>
                        {formatCurrency(activePOTotalAmount)}
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>({activePOTotalQty} sản phẩm)</span>
                    </div>
                  </div>

                  {/* BẢNG CHỈ SỐ THỜI GIAN TRÌNH KÝ & SLA CHUẨN SECTION III */}
                  <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #dce4ee', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={16} color="#0056A3" />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0056A3', textTransform: 'uppercase' }}>
                          BẢNG ĐỐI SOÁT THỜI GIAN XỬ LÝ & TRÌNH KÝ (SECTION III)
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Phiên xử lý: Vòng {activePO.current_round || 1}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>1. Ngày tạo PO (created_at):</div>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>
                          {activePO.created ? new Date(activePO.created).toLocaleString('vi-VN') : '—'}
                        </div>
                      </div>

                      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>2. Ngày gửi trình ký (submitted_at):</div>
                        <div style={{ fontWeight: 700, color: activePO.submitted_at ? '#0056A3' : '#64748b', fontSize: '13px' }}>
                          {activePO.submitted_at ? new Date(activePO.submitted_at).toLocaleString('vi-VN') : 'Chưa gửi trình'}
                        </div>
                      </div>

                      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>3. Ngày hoàn tất phê duyệt (approved_at):</div>
                        <div style={{ fontWeight: 700, color: activePO.approved_at ? '#166534' : '#64748b', fontSize: '13px' }}>
                          {activePO.approved_at ? new Date(activePO.approved_at).toLocaleString('vi-VN') : 'Chưa phê duyệt'}
                        </div>
                      </div>

                      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>4. Ngày phát hành đơn (ordered_at):</div>
                        <div style={{ fontWeight: 700, color: activePO.ordered_at ? '#0056A3' : '#64748b', fontSize: '13px' }}>
                          {activePO.ordered_at ? new Date(activePO.ordered_at).toLocaleString('vi-VN') : 'Chưa đặt hàng'}
                        </div>
                      </div>

                      <div style={{ background: '#eff6ff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                        <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600 }}>Thời gian từ tạo PO đến gửi trình:</div>
                        <div style={{ fontWeight: 800, color: '#1e40af', fontSize: '14px' }}>
                          {activePOTimings.createdToSubmitText || '—'}
                        </div>
                      </div>

                      <div style={{ background: '#ecfdf5', padding: '10px 12px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                        <div style={{ fontSize: '11px', color: '#065f46', fontWeight: 600 }}>Thời gian trình ký (chính xác):</div>
                        <div style={{ fontWeight: 800, color: '#065f46', fontSize: '14px' }}>
                          {activePOTimings.approvalDurationText || '—'}
                        </div>
                        <span style={{ fontSize: '10px', color: '#047857' }}>
                          {activePO.approved_at ? '✓ Theo thời điểm duyệt thành công cuối cùng' : 'Đang trong quá trình xử lý'}
                        </span>
                      </div>

                      <div style={{ background: '#eff6ff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                        <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600 }}>Thời gian từ duyệt đến đặt hàng:</div>
                        <div style={{ fontWeight: 800, color: '#1e40af', fontSize: '14px' }}>
                          {activePOTimings.approvedToOrderText || '—'}
                        </div>
                      </div>

                      <div style={{ background: '#fef3c7', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                        <div style={{ fontSize: '11px', color: '#92400e', fontWeight: 600 }}>Tổng thời gian xử lý:</div>
                        <div style={{ fontWeight: 800, color: '#92400e', fontSize: '14px' }}>
                          {activePOTimings.totalProcessingText || '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Thanh thao tác Workflow nhanh */}
                  <div style={{
                    background: '#ffffff',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #dce4ee',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#334155' }}>Hành động tiếp theo:</span>
                      {activePO.status === 'Chờ trình ký' && (
                        <button type="button" className="btn-workflow btn-primary" onClick={handleActionSubmitApproval}>
                          <Send size={14} style={{ marginRight: 4 }} />
                          Gửi trình ký hồ sơ
                        </button>
                      )}

                      {activePO.status === 'Đang trình ký' && (
                        <>
                          <button type="button" className="btn-workflow btn-success" onClick={handleActionApprove}>
                            <CheckCircle size={14} style={{ marginRight: 4 }} />
                            Phê duyệt hồ sơ
                          </button>
                          <button type="button" className="btn-workflow btn-danger" onClick={handleActionReject}>
                            <AlertOctagon size={14} style={{ marginRight: 4 }} />
                            Từ chối / Yêu cầu rà soát
                          </button>
                        </>
                      )}

                      {activePO.status === 'Đã duyệt' && (
                        <button type="button" className="btn-workflow btn-primary" onClick={handleActionOrder}>
                          <Store size={14} style={{ marginRight: 4 }} />
                          Chuyển sang "Đã đặt hàng"
                        </button>
                      )}

                      {activePO.status === 'Đã đặt hàng' && (
                        <button type="button" className="btn-workflow btn-primary" onClick={handleActionDeliver}>
                          <Truck size={14} style={{ marginRight: 4 }} />
                          Ghi nhận đợt xuất giao hàng
                        </button>
                      )}

                      {(activePO.status === 'Đang giao hàng' || activePO.status === 'Chờ đơn vị xác nhận') && (
                        <button type="button" className="btn-workflow btn-success" onClick={handleActionReceipt}>
                          <PackageCheck size={14} style={{ marginRight: 4 }} />
                          Xác nhận nhận hàng hoàn tất
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-accent"
                        onClick={() => setEmailModalPO(activePO)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
                      >
                        <Mail size={15} />
                        Soạn Email NCC
                      </button>

                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => onExportPO(activePO.id)}
                        disabled={isExporting}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
                      >
                        <FileDown size={15} />
                        Tải 01 file Excel (02 Sheet)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB B: DỮ LIỆU HÀNG HÓA CHI TIẾT (SECTION II.3.B) */}
              {activeTab === 'items' && (
                <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0056A3' }}>
                      Danh Sách Hàng Hóa Trong Hồ Sơ ({activePO.items?.length || 0} dòng)
                    </h4>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                      Hội sở TT: <strong style={{ color: '#0056A3' }}>{formatCurrency(activePOHoiSoAmount)}</strong> • Đơn vị TT: <strong style={{ color: '#d97706' }}>{formatCurrency(activePODonViAmount)}</strong>
                    </div>
                  </div>

                  <div className="table-responsive max-h-450">
                    <table className="procurement-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Đơn vị nhận</th>
                          <th>Mã SP (MSP)</th>
                          <th>Tên hàng hóa & Quy cách</th>
                          <th style={{ textAlign: 'center' }}>SL</th>
                          <th style={{ textAlign: 'right' }}>Đơn giá</th>
                          <th style={{ textAlign: 'right' }}>Thành tiền chưa VAT</th>
                          <th>Nhóm TT</th>
                          <th>Nhà cung cấp</th>
                          <th style={{ textAlign: 'center' }}>Đã giao</th>
                          <th style={{ textAlign: 'center' }}>Đã nhận</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activePO.items || []).map((x, i) => (
                          <tr key={i}>
                            <td style={{ textAlign: 'center' }}>{i + 1}</td>
                            <td style={{ fontWeight: 600 }}>{x.unit}</td>
                            <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{x.msp || '—'}</td>
                            <td>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>{x.item}</div>
                              {x.purpose && <div style={{ fontSize: '11px', color: '#64748b' }}>Mục đích: {x.purpose}</div>}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{x.qty}</td>
                            <td style={{ textAlign: 'right' }}>{formatNumber(x.price)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#0056A3' }}>{formatCurrency(x.amount)}</td>
                            <td>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: (x.payGroup === 'HOI_SO' || x.payGroup === 'A') ? '#eff6ff' : '#fffbeb',
                                color: (x.payGroup === 'HOI_SO' || x.payGroup === 'A') ? '#0056A3' : '#b45309'
                              }}>
                                {(x.payGroup === 'HOI_SO' || x.payGroup === 'A') ? 'Hội sở' : 'Đơn vị'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 500 }}>{x.supplier || 'Chưa chỉ định'}</td>
                            <td style={{ textAlign: 'center', color: '#0284c7' }}>{x.deliveredQty || 0}</td>
                            <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>{x.receivedQty || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB C: PHIẾU TRÌNH VÀ BẢNG KÊ (SECTION II.3.C) */}
              {activeTab === 'sheet' && (
                <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0056A3' }}>
                        Mẫu Phiếu Trình & Bảng Kê (Chuẩn 01 File Excel gồm 02 Sheet)
                      </h4>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                        Sheet 1: PHIẾU TRÌNH (Nhóm Hội sở & Đơn vị riêng) • Sheet 2: BẢNG KÊ (Phần A & Phần B riêng)
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => onExportPO(activePO.id)}
                      disabled={isExporting}
                      style={{ padding: '8px 16px', fontWeight: 700 }}
                    >
                      <FileDown size={16} style={{ marginRight: 6 }} />
                      {isExporting ? 'Đang xuất Excel...' : 'TẢI 01 FILE EXCEL (02 SHEET)'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Tóm tắt Sheet 1 */}
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0056A3', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={16} />
                        SHEET 1: PHIẾU TRÌNH
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.6 }}>
                        <div>• Mẫu phôi: <strong>1_BANG_TRINH_KY.xlsx</strong></div>
                        <div>• Phần Hội sở thanh toán: <strong>{formatCurrency(activePOHoiSoAmount)}</strong></div>
                        <div>• Phần Đơn vị thanh toán: <strong>{formatCurrency(activePODonViAmount)}</strong></div>
                        <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '6px', fontWeight: 700, color: '#0056A3' }}>
                          Tổng cộng chưa bao gồm VAT: {formatCurrency(activePOTotalAmount)}
                        </div>
                      </div>
                    </div>

                    {/* Tóm tắt Sheet 2 */}
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0056A3', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileSpreadsheet size={16} />
                        SHEET 2: BẢNG KÊ
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.6 }}>
                        <div>• Mẫu phôi: <strong>2_BANG_KE.xlsx</strong></div>
                        <div>• Phần A (Hội sở thanh toán): <strong>{(activePO.items || []).filter(x => x.payGroup === 'HOI_SO' || x.payGroup === 'A').length} dòng</strong></div>
                        <div>• Phần B (Đơn vị thanh toán): <strong>{(activePO.items || []).filter(x => x.payGroup === 'DON_VI' || x.payGroup === 'B').length} dòng</strong></div>
                        <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '6px', fontWeight: 700, color: '#0056A3' }}>
                          Khớp số dòng & tổng tiền 100% với Sheet 1
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB D: LỊCH SỬ PHÊ DUYỆT (SECTION II.3.D & SECTION III) */}
              {activeTab === 'approvals' && (
                <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#0056A3' }}>
                    Lịch Sử Các Vòng Trình Ký & Quyết Định Phê Duyệt
                  </h4>
                  {(activePO.approvals || []).length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                      Chưa có phiên trình ký hoặc phê duyệt chính thức nào được ghi nhận cho hồ sơ này.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="procurement-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Vòng (Round)</th>
                            <th>Thời điểm gửi trình</th>
                            <th>Người gửi trình</th>
                            <th>Thời điểm quyết định</th>
                            <th>Người quyết định</th>
                            <th>Kết quả</th>
                            <th>Thời gian xử lý</th>
                            <th>Ý kiến chỉ đạo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activePO.approvals.map((app, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 700, color: '#0056A3' }}>Vòng {app.round || 1}</td>
                              <td>{app.submitted_at ? new Date(app.submitted_at).toLocaleString('vi-VN') : '—'}</td>
                              <td>{app.actor_name || 'Cán bộ QTTS'}</td>
                              <td>{app.decided_at ? new Date(app.decided_at).toLocaleString('vi-VN') : 'Đang xử lý'}</td>
                              <td>{app.actor_role === 'APPROVER' ? app.actor_name : 'Lãnh đạo'}</td>
                              <td>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: app.action === 'APPROVE' ? '#dcfce7' : app.action === 'REJECT' ? '#fee2e2' : '#e0f2fe',
                                  color: app.action === 'APPROVE' ? '#166534' : app.action === 'REJECT' ? '#991b1b' : '#075985'
                                }}>
                                  {app.action === 'APPROVE' ? 'Đã duyệt' : app.action === 'REJECT' ? 'Từ chối' : 'Gửi trình'}
                                </span>
                              </td>
                              <td style={{ fontWeight: 600 }}>
                                {app.duration_hours ? `${app.duration_hours.toFixed(1)} giờ` : '—'}
                              </td>
                              <td style={{ color: '#475569' }}>{app.comment || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB E: NHÀ CUNG CẤP & ĐƠN HÀNG (SECTION II.3.E) */}
              {activeTab === 'suppliers' && (
                <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#0056A3' }}>
                    Danh Sách Nhà Cung Cấp Tham Gia & Đơn Đặt Hàng Phân Bổ
                  </h4>
                  <SupplierOrderManagementSection po={activePO} onPoUpdated={refreshPOs} />
                </div>
              )}

              {/* TAB F: EMAIL ĐÃ GỬI (SECTION II.3.F) */}
              {activeTab === 'emails' && (
                <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#0056A3' }}>
                    Nhật Ký Email Đặt Hàng Đã Gửi Cho Các Nhà Cung Cấp
                  </h4>
                  {(activePO.email_logs || []).length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                      Chưa có email đặt hàng nào được gửi cho NCC từ hồ sơ này.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="procurement-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Thời gian gửi</th>
                            <th>Nhà cung cấp</th>
                            <th>Email người nhận</th>
                            <th>Tiêu đề Email</th>
                            <th>Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activePO.email_logs.map((em, idx) => (
                            <tr key={idx}>
                              <td>{em.admin_confirmed_sent_at ? new Date(em.admin_confirmed_sent_at).toLocaleString('vi-VN') : new Date(em.draft_created_at).toLocaleString('vi-VN')}</td>
                              <td style={{ fontWeight: 600 }}>{em.supplier_name}</td>
                              <td style={{ fontFamily: 'monospace' }}>{em.recipient_email}</td>
                              <td style={{ fontWeight: 600, color: '#0056A3' }}>{em.subject}</td>
                              <td>
                                <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: '11px' }}>
                                  ĐÃ GỬI THÀNH CÔNG
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB G: TIẾN ĐỘ GIAO HÀNG (SECTION II.3.G) */}
              {activeTab === 'deliveries' && (
                <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0056A3' }}>
                      Các Đợt Giao Hàng & Vận Chuyển Logistics ({activePO.deliveries?.length || 0} đợt)
                    </h4>
                  </div>

                  {(activePO.deliveries || []).length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                      Chưa có đợt giao hàng nào được tạo cho hồ sơ này.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="procurement-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Mã đợt</th>
                            <th>Ngày xuất giao</th>
                            <th>Đơn vị vận chuyển</th>
                            <th>Mã vận đơn (Tracking)</th>
                            <th>Trạng thái</th>
                            <th>Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activePO.deliveries.map((del, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{del.delivery_code}</td>
                              <td>{new Date(del.delivery_date).toLocaleString('vi-VN')}</td>
                              <td>{del.carrier || 'Đơn vị vận chuyển'}</td>
                              <td style={{ fontFamily: 'monospace' }}>{del.tracking_number || '—'}</td>
                              <td>
                                <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#e0f2fe', color: '#075985', fontWeight: 700, fontSize: '11px' }}>
                                  {del.status === 'DISPATCHED' ? 'ĐANG VẬN CHUYỂN' : 'ĐÃ TỚI ĐƠN VỊ'}
                                </span>
                              </td>
                              <td>{del.note || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB H: XÁC NHẬN NHẬN HÀNG (SECTION II.3.H) */}
              {activeTab === 'receipts' && (
                <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0056A3' }}>
                      Biên Bản Xác Nhận Nhận Hàng Của Chi Nhánh / PGD / OneBank ({activePO.receipts?.length || 0} biên bản)
                    </h4>
                  </div>

                  {(activePO.receipts || []).length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                      Chưa có biên bản nhận hàng nào được xác nhận từ phía đơn vị nhận.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="procurement-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Mã biên bản</th>
                            <th>Đơn vị nhận</th>
                            <th>Người nhận hàng</th>
                            <th>Ngày nhận</th>
                            <th>Tình trạng hàng</th>
                            <th>Trạng thái nghiệm thu</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activePO.receipts.map((rec, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{rec.receipt_code}</td>
                              <td>{rec.department_name || activePO.representative_unit}</td>
                              <td>{rec.receiver_name}</td>
                              <td>{new Date(rec.received_date).toLocaleDateString('vi-VN')}</td>
                              <td>{rec.condition_note || 'Đầy đủ, nguyên seal'}</td>
                              <td>
                                <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: '11px' }}>
                                  ĐÃ NGHIỆM THU
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB I: LỊCH SỬ HOẠT ĐỘNG (AUDIT LOGS) (SECTION II.3.I) */}
              {activeTab === 'logs' && (
                <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#0056A3' }}>
                    Nhật Ký Hoạt Động & Lịch Sử Thao Tác (Audit Trail)
                  </h4>
                  <div className="logs-list">
                    {(activePO.logs || []).map((log, i) => (
                      <div key={i} className="log-item">
                        <span className="log-time">{log.time}</span>
                        <span className="log-divider">—</span>
                        <span className="log-text">{log.text}</span>
                      </div>
                    ))}
                    {(activePO.logs || []).length === 0 && (
                      <div style={{ padding: '16px', color: '#64748b', textAlign: 'center' }}>
                        Không có nhật ký bổ sung.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Soạn & Gửi Email Đặt hàng theo PO và Nhà Cung Cấp */}
      <OrderEmailModal
        isOpen={Boolean(emailModalPO)}
        onClose={() => setEmailModalPO(null)}
        po={emailModalPO}
        onConfirmSent={handleConfirmOrderEmailSent}
      />
    </div>
  );
}
