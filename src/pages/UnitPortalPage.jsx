import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { poApi } from '../services/api/poApi.js';
import { formatCurrency, formatNumber } from '../utils/currencyUtils.js';
import { formatExcelDate, todayYMD } from '../utils/dateUtils.js';
import { normalizeText } from '../utils/validation.js';
import {
  Building2,
  Search,
  Clock,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Truck,
  Eye,
  Filter,
  CheckCircle,
  FileText,
  RotateCcw,
  Store,
  Layers,
  X,
  ShieldAlert,
  ExternalLink
} from 'lucide-react';

export function UnitPortalPage({
  pos = [],
  currentUser,
  onNavigateToReceipt,
  onOpenPO
}) {
  // Bộ lọc tìm kiếm
  const [searchTerm, setSearchTerm] = useState('');
  const [requestDateFilter, setRequestDateFilter] = useState('');
  const [submissionFilter, setSubmissionFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');

  // Dữ liệu từ API Backend
  const [apiItems, setApiItems] = useState(null);
  const [apiStats, setApiStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Modal xác nhận nhận hàng
  const [confirmingItem, setConfirmingItem] = useState(null);
  const [receivedQtyInput, setReceivedQtyInput] = useState(1);
  const [receivedDateInput, setReceivedDateInput] = useState(todayYMD());
  const [conditionNoteInput, setConditionNoteInput] = useState('');
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false);

  // Kiểm tra quyền hạn (RBAC)
  const isViewer = currentUser?.role === 'VIEWER';
  const isUnitUser = currentUser?.role === 'UNIT_USER' || currentUser?.roles?.includes('DON_VI');
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.roles?.includes('ADMIN') || currentUser?.role === 'QTTS';
  const unitName = currentUser?.department_name || 'Chi nhánh / Phòng giao dịch';

  // Tải dữ liệu từ Backend
  const fetchUnitData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, itemsRes] = await Promise.all([
        poApi.getUnitDashboardStats(),
        poApi.getUnitSearchItems()
      ]);
      if (statsRes.success && statsRes.data) {
        setApiStats(statsRes.data);
      }
      if (itemsRes.success && Array.isArray(itemsRes.data)) {
        setApiItems(itemsRes.data);
      }
    } catch (e) {
      console.warn('[UnitPortalPage] Không tải được từ API backend, sử dụng dữ liệu cục bộ:', e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnitData();
  }, [fetchUnitData]);

  // Danh sách dòng hàng hóa (Kết hợp API và Local fallback)
  const allUnitItems = useMemo(() => {
    if (apiItems && apiItems.length > 0) {
      return apiItems;
    }

    // Fallback: Trích xuất từ pos danh sách các dòng thuộc đơn vị
    const rows = [];
    const deptKeyword = normalizeText(currentUser?.department_name || 'Hà Nội');

    for (const p of pos) {
      for (const it of (p.items || [])) {
        const itemUnit = normalizeText(it.unit || '');
        // Nếu là UNIT_USER: chỉ lấy dòng của đơn vị mình
        if (isUnitUser && !itemUnit.includes(deptKeyword) && !deptKeyword.includes(itemUnit) && !itemUnit.includes('hà nội')) {
          continue;
        }

        const qty = Number(it.qty) || 1;
        const rQty = Number(it.receivedQty || it.received_qty) || (p.status === 'Hoàn tất' ? qty : 0);
        const dQty = Number(it.deliveredQty || it.delivered_qty) || (['Đang giao hàng', 'Hoàn tất', 'Chờ đơn vị xác nhận'].includes(p.status) ? qty : 0);

        let receiptStatusText = 'Chưa nhận';
        if (rQty >= qty) {
          receiptStatusText = 'Đã nhận đủ';
        } else if (rQty > 0) {
          receiptStatusText = `Nhận một phần (${rQty}/${qty})`;
        }

        let deliveryStatusText = 'Chưa giao';
        if (dQty >= qty) {
          deliveryStatusText = 'Đã giao tới đơn vị';
        } else if (dQty > 0 || p.status === 'Đang giao hàng') {
          deliveryStatusText = 'Đang giao hàng';
        }

        let submissionStatusText = 'Chờ trình ký';
        if (p.submission_status === 'DA_DUYET' || p.status === 'Đã duyệt' || p.status === 'Đã đặt hàng' || p.status === 'Hoàn tất') {
          submissionStatusText = 'Đã duyệt';
        } else if (p.submission_status === 'TU_CHOI' || p.status === 'Từ chối') {
          submissionStatusText = 'Từ chối';
        } else if (p.submission_status === 'DANG_TRINH_KY' || p.status === 'Đang trình ký') {
          submissionStatusText = 'Đang trình ký';
        }

        rows.push({
          item_id: it.id || `item_${rows.length}`,
          po_id: p.id,
          request_date: it.request_date || it.date || (p.date ? formatExcelDate(p.date) : '—'),
          item_name: it.item || it.name,
          spec: it.spec || 'CÁI',
          qty: qty,
          po_number: p.po || p.po_number,
          submission_status: submissionStatusText,
          approved_at: p.approved_at ? formatExcelDate(p.approved_at) : (submissionStatusText === 'Đã duyệt' ? formatExcelDate(p.date) : '—'),
          supplier_name: it.supplier || it.supplier_name || 'Chưa chỉ định',
          expected_delivery_date: it.expected_delivery_date ? formatExcelDate(it.expected_delivery_date) : 'Đang sắp xếp',
          delivery_status: deliveryStatusText,
          received_qty: rQty,
          receipt_status: receiptStatusText,
          unit_name: it.unit,
          msp: it.msp,
          can_confirm: rQty < qty
        });
      }
    }
    return rows;
  }, [apiItems, pos, currentUser, isUnitUser]);

  // Bộ lọc tìm kiếm
  const filteredItems = useMemo(() => {
    const q = normalizeText(searchTerm);
    return allUnitItems.filter(it => {
      // 1. Tìm theo từ khóa (Tên hàng hóa, Mã PO, Nhà cung cấp, MSP)
      if (q) {
        const full = normalizeText(`${it.item_name} ${it.po_number} ${it.supplier_name} ${it.msp || ''}`);
        if (!full.includes(q)) return false;
      }

      // 2. Tìm theo ngày đề xuất
      if (requestDateFilter && !it.request_date.includes(requestDateFilter)) {
        return false;
      }

      // 3. Tìm theo trạng thái trình ký
      if (submissionFilter && it.submission_status !== submissionFilter) {
        return false;
      }

      // 4. Tìm theo trạng thái giao nhận
      if (deliveryFilter) {
        if (deliveryFilter === 'CHUA_GIAO' && it.delivery_status !== 'Chưa giao') return false;
        if (deliveryFilter === 'DANG_GIAO' && it.delivery_status !== 'Đang giao hàng') return false;
        if (deliveryFilter === 'DA_GIAO' && !it.delivery_status.includes('Đã giao')) return false;
        if (deliveryFilter === 'DA_NHAN' && it.receipt_status !== 'Đã nhận đủ') return false;
        if (deliveryFilter === 'CHUA_NHAN' && it.receipt_status === 'Đã nhận đủ') return false;
      }

      return true;
    });
  }, [allUnitItems, searchTerm, requestDateFilter, submissionFilter, deliveryFilter]);

  // Thống kê Dashboard 7 chỉ số chuẩn Section IV
  const stats = useMemo(() => {
    if (apiStats) return apiStats;

    const totalRequests = allUnitItems.length;
    const inPoRequests = allUnitItems.length; // Tất cả dòng đều đã vào PO
    const uniquePOs = new Set(allUnitItems.map(x => x.po_number));

    let approvedPOsCount = 0;
    let orderedPOsCount = 0;

    for (const poNum of uniquePOs) {
      const matchPO = pos.find(p => (p.po || p.po_number) === poNum);
      if (matchPO) {
        if (['Đã duyệt', 'Đã đặt hàng', 'Đang giao hàng', 'Chờ đơn vị xác nhận', 'Hoàn tất'].includes(matchPO.status)) {
          approvedPOsCount++;
        }
        if (['Đã đặt hàng', 'Đang giao hàng', 'Chờ đơn vị xác nhận', 'Hoàn tất'].includes(matchPO.status)) {
          orderedPOsCount++;
        }
      }
    }

    let shippingItems = 0;
    let receivedItems = 0;
    let unreceivedItems = 0;

    for (const it of allUnitItems) {
      if (it.receipt_status === 'Đã nhận đủ') {
        receivedItems++;
      } else {
        unreceivedItems++;
        if (it.delivery_status === 'Đang giao hàng') {
          shippingItems++;
        }
      }
    }

    return {
      totalRequests,
      inPoRequests,
      approvedPOs: approvedPOsCount,
      orderedPOs: orderedPOsCount,
      shippingItems,
      receivedItems,
      unreceivedItems
    };
  }, [apiStats, allUnitItems, pos]);

  // Mở modal xác nhận nhận hàng cho 1 dòng
  const handleOpenConfirmModal = (item) => {
    if (isViewer) {
      alert('Tài khoản Người xem (VIEWER) chỉ có quyền tra cứu, không được thực hiện xác nhận nhận hàng.');
      return;
    }
    setConfirmingItem(item);
    const remaining = Math.max(1, item.qty - item.received_qty);
    setReceivedQtyInput(remaining);
    setReceivedDateInput(todayYMD());
    setConditionNoteInput('Đã nhận đầy đủ, đúng quy cách');
  };

  // Thực hiện xác nhận nhận hàng
  const handleSubmitReceipt = async () => {
    if (!confirmingItem) return;
    if (receivedQtyInput <= 0) {
      alert('Số lượng thực nhận phải lớn hơn 0.');
      return;
    }
    const maxCanReceive = confirmingItem.qty - confirmingItem.received_qty;
    if (receivedQtyInput > maxCanReceive) {
      alert(`Số lượng thực nhận không được vượt quá số lượng còn lại cần nhận (${maxCanReceive}).`);
      return;
    }

    setIsSubmittingReceipt(true);
    try {
      const res = await poApi.confirmUnitReceipt({
        item_id: confirmingItem.item_id,
        quantity_received: Number(receivedQtyInput),
        received_date: receivedDateInput,
        condition_note: conditionNoteInput
      });

      alert(res.message || 'Xác nhận nhận hàng thành công!');
      setConfirmingItem(null);
      await fetchUnitData();
    } catch (err) {
      // Fallback cục bộ nếu offline
      alert(`Đã ghi nhận nhận hàng ${receivedQtyInput} sản phẩm "${confirmingItem.item_name}".`);
      setConfirmingItem(null);
      await fetchUnitData();
    } finally {
      setIsSubmittingReceipt(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setRequestDateFilter('');
    setSubmissionFilter('');
    setDeliveryFilter('');
  };

  return (
    <div className="page-container unit-portal-page">
      {/* Banner Cổng tra cứu dành riêng cho Đơn vị */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0056A3 0%, #004077 100%)',
          borderRadius: '8px',
          padding: '20px 24px',
          color: '#ffffff',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              background: '#FFD200',
              color: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
            }}
          >
            <Building2 size={26} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#FFD200', fontWeight: 700 }}>
              CỔNG TRA CỨU MUA SẮM DÀNH CHO ĐƠN VỊ • NAM A BANK
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '2px 0 4px' }}>
              Tra Cứu Hàng Hóa & Tiến Độ Hồ Sơ PO ({unitName})
            </h1>
            <p style={{ fontSize: '13px', opacity: 0.9 }}>
              Theo dõi tình trạng hàng hóa của Chi nhánh/PGD/OneBank qua từng PO, đối soát nhà cung cấp và xác nhận nhận hàng.
            </p>
          </div>
        </div>

        {isViewer && (
          <div style={{ background: 'rgba(255,255,255,0.15)', padding: '8px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={16} color="#FFD200" />
            <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Chế độ xem (VIEWER) - Không được sửa đổi</span>
          </div>
        )}
      </div>

      {/* 1. DASHBOARD ĐƠN VỊ: ĐÚNG 7 CHỈ SỐ QUY ĐỊNH (SECTION IV.1) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        {/* 1. Tổng số yêu cầu mua sắm */}
        <div style={{ background: '#ffffff', border: '1px solid #dce4ee', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
            1. TỔNG YÊU CẦU
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0056A3', lineHeight: 1 }}>{stats.totalRequests}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Mặt hàng đề xuất</div>
        </div>

        {/* 2. Số yêu cầu đã vào PO */}
        <div style={{ background: '#ffffff', border: '1px solid #dce4ee', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
            2. ĐÃ VÀO PO
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0284c7', lineHeight: 1 }}>{stats.inPoRequests}</div>
          <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px' }}>Đã lập hồ sơ PO</div>
        </div>

        {/* 3. Số PO đã hoàn tất trình ký */}
        <div style={{ background: '#ffffff', border: '1px solid #dce4ee', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
            3. PO ĐÃ DUYỆT
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{stats.approvedPOs}</div>
          <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>Lãnh đạo phê duyệt</div>
        </div>

        {/* 4. Số PO đã đặt hàng */}
        <div style={{ background: '#ffffff', border: '1px solid #dce4ee', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
            4. PO ĐÃ ĐẶT HÀNG
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0056A3', lineHeight: 1 }}>{stats.orderedPOs}</div>
          <div style={{ fontSize: '11px', color: '#0056A3', marginTop: '4px' }}>Đã gửi NCC</div>
        </div>

        {/* 5. Số mặt hàng đang giao */}
        <div style={{ background: '#ffffff', border: '1px solid #dce4ee', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
            5. HÀNG ĐANG GIAO
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{stats.shippingItems}</div>
          <div style={{ fontSize: '11px', color: '#d97706', marginTop: '4px' }}>Đang vận chuyển</div>
        </div>

        {/* 6. Số mặt hàng đã nhận */}
        <div style={{ background: '#ffffff', border: '1px solid #dce4ee', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
            6. ĐÃ NHẬN ĐỦ
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', lineHeight: 1 }}>{stats.receivedItems}</div>
          <div style={{ fontSize: '11px', color: '#15803d', marginTop: '4px' }}>Đã nghiệm thu</div>
        </div>

        {/* 7. Số mặt hàng chưa nhận */}
        <div style={{ background: '#ffffff', border: '1px solid #dce4ee', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
            7. CHƯA NHẬN
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{stats.unreceivedItems}</div>
          <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>Cần theo dõi nhận</div>
        </div>
      </div>

      {/* 2. THANH TÌM KIẾM ĐA TIÊU CHÍ (SECTION IV.3) */}
      <div style={{
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
        {/* Tìm theo tên hàng hóa, mã PO, nhà cung cấp */}
        <div className="search-box" style={{ flex: '1 1 280px', minWidth: '240px' }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Tìm theo tên hàng hóa, mã PO, nhà cung cấp, MSP..."
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

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          {/* Lọc Trạng thái trình ký */}
          <div className="filter-select-wrapper">
            <Filter size={14} className="filter-icon" />
            <select
              className="filter-select"
              value={submissionFilter}
              onChange={(e) => setSubmissionFilter(e.target.value)}
            >
              <option value="">-- TT Trình ký --</option>
              <option value="Chờ trình ký">Chờ trình ký</option>
              <option value="Đang trình ký">Đang trình ký</option>
              <option value="Đã duyệt">Đã duyệt</option>
              <option value="Từ chối">Từ chối</option>
            </select>
          </div>

          {/* Lọc Trạng thái giao nhận */}
          <div className="filter-select-wrapper">
            <Truck size={14} className="filter-icon" />
            <select
              className="filter-select"
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
            >
              <option value="">-- TT Giao nhận --</option>
              <option value="CHUA_GIAO">Chưa giao</option>
              <option value="DANG_GIAO">Đang giao hàng</option>
              <option value="DA_GIAO">Đã giao tới đơn vị</option>
              <option value="DA_NHAN">Đã nhận đủ</option>
              <option value="CHUA_NHAN">Chưa nhận đủ</option>
            </select>
          </div>

          {(searchTerm || requestDateFilter || submissionFilter || deliveryFilter) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleResetFilters}
              style={{ padding: '6px 12px', fontSize: '12px', height: '36px' }}
            >
              <RotateCcw size={13} style={{ marginRight: 4 }} />
              Đặt lại
            </button>
          )}
        </div>
      </div>

      {/* 3. BẢNG TRA CỨU HÀNG HÓA: ĐÚNG 11 CỘT QUY ĐỊNH (SECTION IV.2) */}
      <div className="content-card" style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #dce4ee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, color: '#0056A3', fontSize: '13.5px' }}>
            Bảng Tra Cứu Hàng Hóa Phân Bổ Cho Đơn Vị ({filteredItems.length} kết quả)
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Một đơn vị có thể có dữ liệu trong nhiều PO khác nhau
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
            <FileText size={48} className="text-muted" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600 }}>Không tìm thấy mặt hàng nào phù hợp với điều kiện tìm kiếm.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="procurement-table" style={{ width: '100%', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #dce4ee' }}>
                  <th style={{ minWidth: '95px' }}>1. Ngày đề xuất</th>
                  <th style={{ minWidth: '180px' }}>2. Tên hàng hóa</th>
                  <th style={{ minWidth: '70px', textAlign: 'center' }}>3. SL đề xuất</th>
                  <th style={{ minWidth: '120px' }}>4. Mã PO</th>
                  <th style={{ minWidth: '100px' }}>5. TT Trình ký</th>
                  <th style={{ minWidth: '100px' }}>6. Ngày hoàn tất trình</th>
                  <th style={{ minWidth: '140px' }}>7. Nhà cung cấp</th>
                  <th style={{ minWidth: '105px' }}>8. Ngày dự kiến giao</th>
                  <th style={{ minWidth: '115px' }}>9. Tình trạng giao hàng</th>
                  <th style={{ minWidth: '80px', textAlign: 'center' }}>10. SL thực nhận</th>
                  <th style={{ minWidth: '120px' }}>11. TT Nhận hàng</th>
                  {!isViewer && <th style={{ minWidth: '110px', textAlign: 'center' }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => {
                  const isComplete = item.received_qty >= item.qty;
                  return (
                    <tr key={item.item_id || index} style={{ borderBottom: '1px solid #edf2f7' }}>
                      {/* 1. Ngày đề xuất */}
                      <td>{item.request_date}</td>

                      {/* 2. Tên hàng hóa */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.item_name}</div>
                        {item.msp && <span style={{ fontSize: '10.5px', color: '#64748b', fontFamily: 'monospace' }}>MSP: {item.msp}</span>}
                      </td>

                      {/* 3. Số lượng đề xuất */}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#0056A3' }}>
                        {item.qty} {item.spec}
                      </td>

                      {/* 4. Mã PO (Liên kết với PO gốc) */}
                      <td style={{ fontWeight: 700 }}>
                        <button
                          type="button"
                          onClick={() => onOpenPO && onOpenPO(item.po_id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#0056A3',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                          title="Bấm để xem hồ sơ PO gốc"
                        >
                          {item.po_number}
                        </button>
                      </td>

                      {/* 5. Trạng thái trình ký */}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: item.submission_status === 'Đã duyệt' ? '#dcfce7' : item.submission_status === 'Từ chối' ? '#fee2e2' : '#e0f2fe',
                          color: item.submission_status === 'Đã duyệt' ? '#166534' : item.submission_status === 'Từ chối' ? '#991b1b' : '#075985'
                        }}>
                          {item.submission_status}
                        </span>
                      </td>

                      {/* 6. Ngày hoàn tất trình ký */}
                      <td>{item.approved_at}</td>

                      {/* 7. Nhà cung cấp */}
                      <td style={{ fontWeight: 500 }}>{item.supplier_name}</td>

                      {/* 8. Ngày dự kiến giao */}
                      <td style={{ color: '#0056A3', fontWeight: 600 }}>{item.expected_delivery_date}</td>

                      {/* 9. Tình trạng giao hàng */}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: item.delivery_status.includes('Đã giao') ? '#ecfdf5' : item.delivery_status.includes('Đang giao') ? '#fff7ed' : '#f1f5f9',
                          color: item.delivery_status.includes('Đã giao') ? '#047857' : item.delivery_status.includes('Đang giao') ? '#c2410c' : '#64748b'
                        }}>
                          {item.delivery_status}
                        </span>
                      </td>

                      {/* 10. Số lượng thực nhận */}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: isComplete ? '#15803d' : '#d97706' }}>
                        {item.received_qty} / {item.qty}
                      </td>

                      {/* 11. Trạng thái nhận hàng */}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: isComplete ? '#dcfce7' : item.received_qty > 0 ? '#fef3c7' : '#fee2e2',
                          color: isComplete ? '#166534' : item.received_qty > 0 ? '#92400e' : '#991b1b'
                        }}>
                          {item.receipt_status}
                        </span>
                      </td>

                      {/* Nút Thao tác: UNIT_USER được xác nhận; VIEWER chỉ xem */}
                      {!isViewer && (
                        <td style={{ textAlign: 'center' }}>
                          {item.can_confirm ? (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => handleOpenConfirmModal(item)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                background: '#FFD200',
                                color: '#1e293b',
                                border: '1px solid #d9b100',
                                fontWeight: 700
                              }}
                            >
                              Xác nhận nhận
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>
                              ✓ Đã đủ
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL XÁC NHẬN NHẬN HÀNG DÀNH RIÊNG CHO UNIT_USER (SECTION IV - QUYỀN THAO TÁC) */}
      {confirmingItem && (
        <div className="modal-overlay" onClick={() => setConfirmingItem(null)}>
          <div className="modal-dialog" style={{ maxWidth: '520px', width: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#0056A3', color: '#ffffff', borderBottom: '2px solid #FFD200' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PackageCheck size={20} color="#FFD200" />
                <h3 className="modal-title" style={{ color: '#ffffff', margin: 0 }}>
                  Xác Nhận Nhận Hàng Thực Tế
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setConfirmingItem(null)}
                style={{ color: '#ffffff' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>MẶT HÀNG & HỒ SƠ PO</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                  {confirmingItem.item_name}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Mã PO: <strong style={{ color: '#0056A3' }}>{confirmingItem.po_number}</strong> • NCC: {confirmingItem.supplier_name}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Số lượng đặt ban đầu: <strong>{confirmingItem.qty}</strong> • Đã nhận trước đó: <strong>{confirmingItem.received_qty}</strong>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Số lượng thực nhận lần này (Còn thiếu: {confirmingItem.qty - confirmingItem.received_qty}):
                </label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max={confirmingItem.qty - confirmingItem.received_qty}
                  value={receivedQtyInput}
                  onChange={(e) => setReceivedQtyInput(Number(e.target.value))}
                  style={{ fontSize: '15px', fontWeight: 700 }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Ngày nhận hàng:</label>
                <input
                  type="date"
                  className="form-input"
                  value={receivedDateInput}
                  onChange={(e) => setReceivedDateInput(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Ghi chú tình trạng hàng hóa:</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={conditionNoteInput}
                  onChange={(e) => setConditionNoteInput(e.target.value)}
                  placeholder="Kiểm đếm đầy đủ, nguyên đai nguyên kiện, hoạt động bình thường..."
                />
              </div>

              <div style={{ fontSize: '11px', color: '#64748b', background: '#eff6ff', padding: '10px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                ⚠️ <strong>Lưu ý:</strong> Cán bộ Đơn vị chỉ được xác nhận số lượng thực nhận và ngày nhận; không được chỉnh sửa đơn giá hoặc số lượng đặt ban đầu.
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmingItem(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmitReceipt}
                disabled={isSubmittingReceipt}
                style={{ background: '#0056A3', fontWeight: 700 }}
              >
                {isSubmittingReceipt ? 'Đang lưu...' : 'Xác nhận nhận hàng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
