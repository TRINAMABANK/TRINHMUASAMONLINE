import React, { useState, useMemo, useEffect } from 'react';
import { lifecycleApi } from '../services/api/lifecycleApi.js';
import { TimelineView } from '../components/TimelineView.jsx';
import { formatCurrency, formatNumber } from '../utils/currencyUtils.js';
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
  ArrowRight,
  Filter,
  CheckCircle,
  FileText
} from 'lucide-react';

export function UnitPortalPage({ pos = [], currentUser, onNavigateToReceipt, onOpenPO }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPO, setSelectedPO] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Tên đơn vị của user hiện tại
  const unitName = currentUser?.department_name || 'Chi nhánh Hà Nội';

  // Lọc các PO thuộc về đơn vị của người dùng (hoặc tất cả nếu là ADMIN/QTTS đang kiểm tra Cổng đơn vị)
  const unitPOs = useMemo(() => {
    return pos.filter(po => {
      // Nếu là UNIT_USER, chỉ lấy các dòng khớp đơn vị
      if (currentUser?.role === 'UNIT_USER') {
        const hasUnitItem = (po.items || []).some(item => {
          const u = (item.unit || item.unit_name || '').toLowerCase();
          return u.includes(unitName.toLowerCase()) || unitName.toLowerCase().includes(u) || u.includes('hà nội');
        });
        if (!hasUnitItem) return false;
      }

      // Bộ lọc từ khóa (Mã PO, Tên hàng, Mã PYC)
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const poNumMatch = (po.poNumber || po.po_number || '').toLowerCase().includes(q);
        const titleMatch = (po.title || '').toLowerCase().includes(q);
        const itemMatch = (po.items || []).some(i => (i.name || '').toLowerCase().includes(q));
        if (!poNumMatch && !titleMatch && !itemMatch) return false;
      }

      // Bộ lọc trạng thái
      if (statusFilter) {
        if (po.delivery_status !== statusFilter && po.status !== statusFilter) return false;
      }

      return true;
    });
  }, [pos, currentUser, unitName, searchQuery, statusFilter]);

  // Khi chọn 1 PO, tải timeline từ backend
  const handleSelectPO = async (po) => {
    setSelectedPO(po);
    setLoadingTimeline(true);
    try {
      const res = await lifecycleApi.getPoTimeline(po.id);
      if (res.success && res.data) {
        setTimelineData(res.data);
      }
    } catch (e) {
      console.warn('Lỗi tải timeline từ backend:', e);
      // Giả lập timeline cục bộ
      setTimelineData({
        po_id: po.id,
        po_number: po.poNumber || po.po_number,
        current_stage: po.status === 'Đã nhận hàng' ? 'HOAN_TAT' : po.status === 'Đang giao hàng' ? 'DANG_GIAO_HANG' : 'DA_DAT_HANG',
        submission_status: 'DA_DUYET',
        po_status: 'DA_TAO_PO',
        delivery_status: po.delivery_status || 'DANG_GIAO',
        durations: {
          current_waiting_hours: 12.5,
          total_lifecycle_days: 2.5
        },
        sla: {
          is_overdue: false,
          days_overdue: 0,
          expected_delivery_date: new Date(Date.now() + 86400000 * 2).toISOString()
        },
        stages: [],
        events: []
      });
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Mặc định chọn PO đầu tiên nếu có
  useEffect(() => {
    if (unitPOs.length > 0 && !selectedPO) {
      handleSelectPO(unitPOs[0]);
    }
  }, [unitPOs]);

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
              CỔNG DỊCH VỤ NỘI BỘ • NAM A BANK
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '2px 0 4px' }}>
              Cổng Tra Cứu Tiến Độ & Nhận Hàng Đơn Vị ({unitName})
            </h1>
            <p style={{ fontSize: '13px', opacity: 0.9 }}>
              Tra cứu hồ sơ mua sắm được cấp phát cho Chi nhánh/PGD/OneBank, theo dõi thời gian giao hàng và xác nhận nhận hàng.
            </p>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.12)', padding: '10px 16px', borderRadius: '6px', textAlign: 'right' }}>
          <div style={{ fontSize: '11px', opacity: 0.8 }}>Hồ sơ đang phụ trách</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#FFD200' }}>
            {unitPOs.length} <span style={{ fontSize: '13px', fontWeight: 400, color: '#ffffff' }}>hồ sơ</span>
          </div>
        </div>
      </div>

      {/* Thanh tìm kiếm & lọc */}
      <div
        style={{
          background: '#ffffff',
          padding: '14px 18px',
          borderRadius: '8px',
          border: '1px solid #dce4ee',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Tra cứu theo mã PO (vd: PO-2026-00048), tên hàng hóa, mã yêu cầu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '34px', fontSize: '13px', height: '36px' }}
          />
        </div>

        <div style={{ width: '220px' }}>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontSize: '13px', height: '36px' }}
          >
            <option value="">-- Tất cả trạng thái --</option>
            <option value="DANG_GIAO">Đang vận chuyển</option>
            <option value="DOI_TAC_DA_GIAO">Đối tác đã giao (Cần nhận)</option>
            <option value="HOAN_TAT">Đã nhận đủ hoàn tất</option>
            <option value="GIAO_THIEU">Giao thiếu / Ngoại lệ</option>
          </select>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={() => { setSearchQuery(''); setStatusFilter(''); }}
          style={{ height: '36px', fontSize: '12px' }}
        >
          Đặt lại
        </button>
      </div>

      {/* Grid: Danh sách PO (bên trái) + Chi tiết & Timeline (bên phải) */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Cột trái: Danh sách PO của đơn vị */}
        <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 700, color: '#0056A3', fontSize: '13px' }}>
            Hồ sơ mua sắm cấp cho Đơn vị ({unitPOs.length})
          </div>

          <div style={{ maxHeight: '680px', overflowY: 'auto' }}>
            {unitPOs.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Không tìm thấy hồ sơ nào phù hợp với đơn vị của bạn.
              </div>
            ) : (
              unitPOs.map(po => {
                const isSelected = selectedPO?.id === po.id;
                const poNum = po.poNumber || po.po_number;
                const totalAmt = po.totalAmount || po.total_amount || 0;
                const delStatus = po.delivery_status || 'CHUA_GIAO';

                return (
                  <div
                    key={po.id}
                    onClick={() => handleSelectPO(po)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: isSelected ? '#f0f7ff' : '#ffffff',
                      borderLeft: isSelected ? '4px solid #0056A3' : '4px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = '#ffffff'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#0056A3', fontSize: '14px' }}>
                        {poNum}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: delStatus === 'HOAN_TAT' ? '#dcfce7' : delStatus === 'DANG_GIAO' ? '#f3e8ff' : '#fffbeb', color: delStatus === 'HOAN_TAT' ? '#166534' : delStatus === 'DANG_GIAO' ? '#7e22ce' : '#92400e' }}>
                        {delStatus === 'HOAN_TAT' ? 'Đã nhận đủ' : delStatus === 'DANG_GIAO' ? 'Đang giao' : 'Đang xử lý'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px', fontWeight: 500, lineHeight: 1.3 }}>
                      {po.title || `Trang bị mua sắm cho Đơn vị theo ${poNum}`}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
                      <span>{(po.items || []).length} mặt hàng</span>
                      <strong style={{ color: '#0056A3', fontSize: '12px' }}>{formatCurrency(totalAmt)}</strong>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Cột phải: Thông tin chi tiết PO, Bảng hàng hóa & Dòng thời gian Timeline */}
        {selectedPO ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Thẻ tóm tắt thông tin PO & Nút xác nhận nhận hàng */}
            <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #edf2f7', paddingBottom: '14px', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    HỒ SƠ MUA SẮM ĐANG XEM
                  </div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0056A3', margin: '2px 0' }}>
                    {selectedPO.poNumber || selectedPO.po_number}
                  </h2>
                  <div style={{ fontSize: '13px', color: '#334155' }}>
                    {selectedPO.title || 'Trang bị mua sắm Các tài sản cố định/Công cụ lao động cho đơn vị'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => onNavigateToReceipt && onNavigateToReceipt(selectedPO.id)}
                    style={{
                      background: '#FFD200',
                      color: '#1e293b',
                      border: '1px solid #d9b100',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <PackageCheck size={16} />
                    Xác nhận nhận hàng ngay
                  </button>
                </div>
              </div>

              {/* Các mốc thời gian quan trọng */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Ngày xuất phiếu trình:</span>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>
                    {selectedPO.created ? new Date(selectedPO.created).toLocaleDateString('vi-VN') : '—'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Ngày phê duyệt:</span>
                  <div style={{ fontWeight: 600, color: '#166534' }}>
                    {selectedPO.approvedDate ? new Date(selectedPO.approvedDate).toLocaleDateString('vi-VN') : 'Đã phê duyệt'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Ngày đặt hàng PO:</span>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>
                    {selectedPO.orderDate ? new Date(selectedPO.orderDate).toLocaleDateString('vi-VN') : '—'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Ngày hẹn giao dự kiến:</span>
                  <div style={{ fontWeight: 700, color: '#0056A3' }}>
                    {timelineData?.sla?.expected_delivery_date
                      ? new Date(timelineData.sla.expected_delivery_date).toLocaleDateString('vi-VN')
                      : 'Đang chờ NCC hẹn'}
                  </div>
                </div>
              </div>
            </div>

            {/* Bảng kê hàng hóa: Số lượng đặt, giao và thực nhận */}
            <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0056A3' }}>
                  Danh sách hàng hóa cấp cho Đơn vị ({selectedPO.items?.length || 0} món)
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  So sánh: Đặt ➔ Giao ➔ Nhận
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '40px' }}>STT</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tên hàng hóa & Quy cách</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Nhà cung cấp</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '80px' }}>SL Đặt</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '80px' }}>SL Giao</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '80px' }}>SL Đã nhận</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '100px' }}>Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedPO.items || []).map((item, idx) => {
                      const qty = Number(item.qty) || 0;
                      const rQty = Number(item.received_qty) || (selectedPO.status === 'Đã nhận hàng' ? qty : 0);
                      const isComplete = rQty >= qty;

                      return (
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>
                            {item.name}
                            {item.spec && <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>{item.spec}</div>}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>
                            {item.supplier || item.supplier_name || '—'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>
                            {qty}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: '#0056A3', fontWeight: 600 }}>
                            {qty}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: isComplete ? '#166534' : '#d97706' }}>
                            {rQty}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, background: isComplete ? '#dcfce7' : '#fffbeb', color: isComplete ? '#166534' : '#92400e' }}>
                              {isComplete ? 'Đã nhận đủ' : 'Chờ kiểm đếm'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dòng thời gian vòng đời 9 công đoạn */}
            <TimelineView timelineData={timelineData} isLoading={loadingTimeline} />
          </div>
        ) : (
          <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            Vui lòng chọn một hồ sơ PO bên trái để xem tiến độ và kiểm đếm nhận hàng
          </div>
        )}
      </div>
    </div>
  );
}
