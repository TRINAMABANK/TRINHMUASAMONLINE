import React, { useState, useMemo, useEffect } from 'react';
import { deliveryApi } from '../services/api/lifecycleApi.js';
import { formatCurrency, formatNumber } from '../utils/currencyUtils.js';
import {
  Store,
  CheckCircle2,
  Calendar,
  Truck,
  Clock,
  History,
  FileCheck,
  Send,
  AlertCircle,
  Phone,
  User,
  Paperclip,
  Check,
  X
} from 'lucide-react';

export function SupplierPortalPage({
  pos = [],
  currentUser,
  onRefreshPOs,
  preselectedPONumber = '',
  preselectedSupplierCode = ''
}) {
  const [selectedPO, setSelectedPO] = useState(null);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'dispatch'
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Đọc tham số PO và NCC từ props hoặc URL query
  const effectivePONumber = preselectedPONumber || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('po') : '') || '';
  const effectiveSupplierCode = preselectedSupplierCode || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('supplier') : '') || '';

  // Tên nhà cung cấp của user hiện tại
  const supplierName = currentUser?.supplier_name || (effectiveSupplierCode ? `Nhà cung cấp ${effectiveSupplierCode}` : 'Công ty Cổ phần Viễn thông FTI');

  // Lọc PO thuộc về nhà cung cấp này
  const supplierPOs = useMemo(() => {
    return pos.filter(po => {
      if (effectivePONumber) {
        const poNum = (po.po || po.po_number || po.poNumber || '').toLowerCase();
        if (poNum === effectivePONumber.toLowerCase()) return true;
      }
      if (currentUser?.role === 'SUPPLIER' || effectiveSupplierCode) {
        const target = (effectiveSupplierCode || supplierName).toLowerCase();
        return (po.items || []).some(item => {
          const sup = (item.supplier || item.supplier_name || '').toLowerCase();
          return sup.includes(target) || target.includes(sup) || sup.includes('fti');
        });
      }
      return true; // Admin/QTTS test xem được tất cả
    });
  }, [pos, currentUser, supplierName, effectivePONumber, effectiveSupplierCode]);

  // Modal hẹn ngày giao & xem lịch sử thay đổi
  const [showDateModal, setShowDateModal] = useState(false);
  const [newExpectedDate, setNewExpectedDate] = useState('');
  const [dateChangeReason, setDateChangeReason] = useState('');
  const [dateHistory, setDateHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Ô nhập trực tiếp THỜI GIAN DỰ KIẾN GIAO HÀNG theo Mục D
  const [directExpectedDate, setDirectExpectedDate] = useState('');

  // Form báo xuất kho / giao hàng nhiều đợt
  const [transporterName, setTransporterName] = useState('Viettel Post / Giao hàng nhanh');
  const [transporterPhone, setTransporterPhone] = useState('0988.123.456');
  const [actualDeliveryDate, setActualDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryNotes, setDeliveryNotes] = useState('Xuất kho đợt 1 theo phiếu xuất kho nội bộ');
  const [dispatchItems, setDispatchItems] = useState([]);

  // Khi chọn PO, khởi tạo dữ liệu dispatch và lọc đúng hàng hóa của NCC
  const handleSelectPO = async (po) => {
    setSelectedPO(po);
    const targetSup = (effectiveSupplierCode || supplierName || '').toLowerCase();
    const filteredItems = (po.items || []).filter(item => {
      if (!effectiveSupplierCode && currentUser?.role !== 'SUPPLIER') return true;
      const sup = (item.supplier || item.supplier_name || '').toLowerCase();
      return sup.includes(targetSup) || targetSup.includes(sup) || sup.includes('fti');
    });
    const effectiveItems = filteredItems.length > 0 ? filteredItems : (po.items || []);

    const items = effectiveItems.map(item => ({
      id: item.id,
      name: item.name || item.item,
      spec: item.spec,
      unit: item.unit || item.unit_name,
      qty: Number(item.qty) || 0,
      price: Number(item.price) || 0,
      amount: Number(item.amount) || ((Number(item.qty) || 0) * (Number(item.price) || 0)),
      dispatched_qty: Number(item.qty) || 0 // Mặc định giao đủ số lượng còn lại
    }));
    setDispatchItems(items);

    if (po.expected_delivery_date) {
      setDirectExpectedDate(String(po.expected_delivery_date).slice(0, 10));
    }
  };

  // Tự động chọn PO khi có tham số trên URL
  useEffect(() => {
    if (effectivePONumber && pos.length > 0) {
      const match = pos.find(p =>
        (p.po && p.po.toLowerCase() === effectivePONumber.toLowerCase()) ||
        (p.po_number && p.po_number.toLowerCase() === effectivePONumber.toLowerCase()) ||
        (p.poNumber && p.poNumber.toLowerCase() === effectivePONumber.toLowerCase())
      );
      if (match) {
        handleSelectPO(match);
      }
    }
  }, [effectivePONumber, pos]);

  useEffect(() => {
    if (supplierPOs.length > 0 && !selectedPO && !effectivePONumber) {
      handleSelectPO(supplierPOs[0]);
    }
  }, [supplierPOs, selectedPO, effectivePONumber]);

  // Hành động 1: Nhà cung cấp xác nhận đơn hàng
  const handleConfirmOrder = async () => {
    if (!selectedPO) return;
    if (!window.confirm(`Xác nhận tiếp nhận thực hiện đơn hàng ${selectedPO.poNumber || selectedPO.po_number}?`)) return;

    setIsLoading(true);
    try {
      const res = await deliveryApi.confirmOrder(selectedPO.id, 'NCC đã tiếp nhận đơn hàng và chuẩn bị xuất kho.');
      if (res.success) {
        setSuccessMessage('Đã xác nhận tiếp nhận đơn hàng thành công!');
        if (onRefreshPOs) onRefreshPOs();
      }
    } catch (e) {
      alert(`Lỗi xác nhận đơn: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Cập nhật nhanh THỜI GIAN DỰ KIẾN GIAO HÀNG theo Mục D
  const handleQuickSaveExpectedDate = async (e) => {
    if (e) e.preventDefault();
    if (!directExpectedDate) {
      alert('Vui lòng chọn ngày hẹn giao dự kiến.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await deliveryApi.updateExpectedDate(selectedPO.id, directExpectedDate, 'Nhà cung cấp cập nhật qua Cổng Đối tác');
      if (res.success) {
        setSuccessMessage(`Đã cập nhật thời gian dự kiến giao hàng: ${directExpectedDate}`);
        if (onRefreshPOs) onRefreshPOs();
      }
    } catch (e) {
      alert(`Lỗi cập nhật ngày hẹn giao: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Mở modal hẹn ngày giao & tải lịch sử thay đổi
  const openDateModal = async () => {
    if (!selectedPO) return;
    setShowDateModal(true);
    setLoadingHistory(true);
    try {
      const res = await deliveryApi.getExpectedDateHistory(selectedPO.id);
      if (res.success && Array.isArray(res.data)) {
        setDateHistory(res.data);
      }
    } catch (e) {
      console.warn('Lỗi tải lịch sử ngày:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Hành động 2: Cập nhật ngày hẹn giao có lưu lý do
  const handleSaveExpectedDate = async (e) => {
    e.preventDefault();
    if (!newExpectedDate) {
      alert('Vui lòng chọn ngày hẹn giao dự kiến.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await deliveryApi.updateExpectedDate(selectedPO.id, newExpectedDate, dateChangeReason);
      if (res.success) {
        setSuccessMessage('Đã cập nhật ngày hẹn giao và lưu vết lịch sử thành công!');
        setShowDateModal(false);
        setNewExpectedDate('');
        setDateChangeReason('');
        if (onRefreshPOs) onRefreshPOs();
      }
    } catch (e) {
      alert(`Lỗi cập nhật: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Hành động 3: Báo xuất kho & Bắt đầu giao hàng (Nhiều đợt)
  const handleDispatchDelivery = async (e) => {
    e.preventDefault();
    if (!selectedPO) return;

    setIsLoading(true);
    try {
      const payload = {
        delivery_code: `DEL-${selectedPO.poNumber || selectedPO.po_number}-${Date.now().toString().slice(-4)}`,
        transporter_name: transporterName,
        transporter_phone: transporterPhone,
        actual_delivery_date: actualDeliveryDate,
        notes: deliveryNotes,
        items: dispatchItems.map(it => ({
          po_item_id: it.id,
          dispatched_qty: it.dispatched_qty
        }))
      };

      const res = await deliveryApi.dispatchDelivery(selectedPO.id, payload);
      if (res.success) {
        setSuccessMessage('Đã báo xuất kho và cập nhật trạng thái "Đang giao hàng" thành công!');
        setActiveTab('list');
        if (onRefreshPOs) onRefreshPOs();
      }
    } catch (e) {
      alert(`Lỗi xuất kho giao hàng: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-container supplier-portal-page">
      {/* Banner Cổng NCC */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
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
              boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
            }}
          >
            <Store size={26} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#FFD200', fontWeight: 700 }}>
              CỔNG TÁC NGHIỆP ĐỐI TÁC • NHÀ CUNG CẤP
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '2px 0 4px' }}>
              {supplierName}
            </h1>
            <p style={{ fontSize: '13px', opacity: 0.9 }}>
              Tiếp nhận đơn hàng PO từ Nam A Bank, cập nhật lịch giao hàng và điều phối xuất kho vận chuyển.
            </p>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px 16px', borderRadius: '6px', textAlign: 'right' }}>
          <div style={{ fontSize: '11px', opacity: 0.8 }}>Đơn hàng được phân bổ</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#FFD200' }}>
            {supplierPOs.length} <span style={{ fontSize: '13px', fontWeight: 400, color: '#ffffff' }}>PO</span>
          </div>
        </div>
      </div>

      {/* Banner truy cập qua link riêng NCC theo Mục D */}
      {effectiveSupplierCode && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderLeft: '4px solid #1e40af',
          borderRadius: '6px',
          padding: '12px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#1e40af',
          fontSize: '13px'
        }}>
          <CheckCircle2 size={20} color="#2563eb" style={{ flexShrink: 0 }} />
          <div>
            <strong>CỔNG TIẾP NHẬN ĐƠN HÀNG NAM A BANK:</strong> Quý Nhà cung cấp <strong>{effectiveSupplierCode}</strong> đang truy cập theo mã đơn <strong>{selectedPO?.poNumber || selectedPO?.po_number || effectivePONumber}</strong>. Dữ liệu giá và số lượng được cố định theo hồ sơ ngân hàng (chế độ chỉ xem, không chỉnh sửa).
          </div>
        </div>
      )}

      {/* Thông báo thành công */}
      {successMessage && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '6px', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px' }}>
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Layout 2 cột */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Cột trái: Danh sách PO của đối tác */}
        <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 700, color: '#0056A3', fontSize: '13px' }}>
            Đơn hàng PO cần xử lý ({supplierPOs.length})
          </div>

          <div style={{ maxHeight: '680px', overflowY: 'auto' }}>
            {supplierPOs.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Không có đơn hàng nào được giao cho bạn.
              </div>
            ) : (
              supplierPOs.map(po => {
                const isSelected = selectedPO?.id === po.id;
                const poNum = po.poNumber || po.po_number;
                const totalAmt = po.totalAmount || po.total_amount || 0;
                const poStat = po.po_status || 'DA_TAO_PO';

                return (
                  <div
                    key={po.id}
                    onClick={() => handleSelectPO(po)}
                    style={{
                      padding: '14px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      borderLeft: isSelected ? '4px solid #1e3a8a' : '4px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '14px' }}>
                        {poNum}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: poStat === 'DOI_TAC_XAC_NHAN' ? '#dbeafe' : '#fef3c7', color: poStat === 'DOI_TAC_XAC_NHAN' ? '#1e40af' : '#92400e' }}>
                        {poStat === 'DOI_TAC_XAC_NHAN' ? 'Đã nhận đơn' : 'Chờ xác nhận'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px', lineHeight: 1.3 }}>
                      {po.title || `Cung cấp thiết bị theo đơn hàng ${poNum}`}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
                      <span>{(po.items || []).length} mục hàng</span>
                      <strong style={{ color: '#1e3a8a', fontSize: '12px' }}>{formatCurrency(totalAmt)}</strong>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Cột phải: Thao tác tiếp nhận, hẹn ngày và xuất kho */}
        {selectedPO ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header chi tiết PO & Action Bar */}
            <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #edf2f7', paddingBottom: '14px', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    HỒ SƠ PO ĐƯỢC CHỌN
                  </div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1e3a8a', margin: '2px 0' }}>
                    {selectedPO.poNumber || selectedPO.po_number}
                  </h2>
                </div>

                {/* 3 Nút Thao tác chính của NCC */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Action 1: Xác nhận đơn */}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleConfirmOrder}
                    disabled={isLoading || selectedPO.po_status === 'DOI_TAC_XAC_NHAN'}
                    style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <CheckCircle2 size={15} color="#16a34a" />
                    {selectedPO.po_status === 'DOI_TAC_XAC_NHAN' ? 'Đã nhận đơn' : '1. Xác nhận nhận đơn'}
                  </button>

                  {/* Action 2: Hẹn ngày giao */}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={openDateModal}
                    disabled={isLoading}
                    style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Calendar size={15} color="#0056A3" />
                    2. Hẹn ngày giao & Lịch sử
                  </button>

                  {/* Action 3: Báo xuất kho */}
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setActiveTab('dispatch')}
                    style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: '#0056A3' }}
                  >
                    <Truck size={15} />
                    3. Báo xuất kho / Giao hàng
                  </button>
                </div>
              </div>

              {/* Thông tin đơn hàng tóm tắt */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Trạng thái PO:</span>
                  <div style={{ fontWeight: 700, color: '#1e3a8a' }}>{selectedPO.po_status || 'DA_TAO_PO'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Trạng thái giao:</span>
                  <div style={{ fontWeight: 700, color: '#ea580c' }}>{selectedPO.delivery_status || 'CHUA_GIAO'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Ngày lập:</span>
                  <div style={{ fontWeight: 600 }}>{selectedPO.created ? new Date(selectedPO.created).toLocaleDateString('vi-VN') : '—'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Tổng giá trị:</span>
                  <div style={{ fontWeight: 800, color: '#0056A3' }}>{formatCurrency(selectedPO.totalAmount || selectedPO.total_amount || 0)}</div>
                </div>
              </div>

              {/* Ô NHẬP TRỰC TIẾP THỜI GIAN DỰ KIẾN GIAO HÀNG (MỤC D) */}
              <div style={{
                marginTop: '16px',
                paddingTop: '14px',
                borderTop: '1px dashed #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                background: '#f8fafc',
                padding: '12px 14px',
                borderRadius: '6px'
              }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0056A3', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={16} />
                  THỜI GIAN DỰ KIẾN GIAO HÀNG:
                </span>
                <input
                  type="date"
                  value={directExpectedDate}
                  onChange={(e) => setDirectExpectedDate(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    borderRadius: '5px',
                    border: '1.5px solid #0056A3',
                    fontWeight: 600,
                    color: '#0056A3'
                  }}
                />
                <button
                  type="button"
                  onClick={handleQuickSaveExpectedDate}
                  disabled={isLoading || !directExpectedDate}
                  className="btn-primary"
                  style={{
                    padding: '7px 16px',
                    fontSize: '12.5px',
                    background: '#0056A3',
                    borderColor: '#0056A3',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer'
                  }}
                >
                  <Check size={14} />
                  Cập nhật thời gian giao
                </button>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  (NCC cập nhật để Nam A Bank theo dõi tiến độ giao hàng)
                </span>
              </div>
            </div>

            {/* Chuyển đổi giữa Xem danh mục hàng & Báo xuất kho */}
            {activeTab === 'dispatch' ? (
              /* FORM BÁO XUẤT KHO / GIAO NHIỀU ĐỢT */
              <div style={{ background: '#ffffff', borderRadius: '8px', border: '2px solid #0056A3', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0056A3', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Truck size={18} />
                    <span>Lập Phiếu Xuất Kho & Điều Phối Giao Hàng (Hỗ trợ nhiều đợt)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '12px' }}
                  >
                    Quay lại danh mục
                  </button>
                </div>

                <form onSubmit={handleDispatchDelivery}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Ngày giao hàng thực tế:
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={actualDeliveryDate}
                        onChange={(e) => setActualDeliveryDate(e.target.value)}
                        required
                        style={{ fontSize: '13px', height: '36px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Đơn vị vận chuyển / Người giao:
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Vd: Viettel Post / Anh Hùng"
                        value={transporterName}
                        onChange={(e) => setTransporterName(e.target.value)}
                        required
                        style={{ fontSize: '13px', height: '36px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                        Số điện thoại người giao:
                      </label>
                      <input
                        type="tel"
                        className="form-control"
                        placeholder="Vd: 0988.xxx.xxx"
                        value={transporterPhone}
                        onChange={(e) => setTransporterPhone(e.target.value)}
                        required
                        style={{ fontSize: '13px', height: '36px' }}
                      />
                    </div>
                  </div>

                  {/* Bảng phân bổ số lượng giao cho từng món trong đợt này */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                      Phân bổ số lượng giao đợt này (cho phép giao một phần / nhiều đợt):
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #e2e8f0' }}>
                      <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px' }}>STT</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Tên hàng hóa & Quy cách</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '90px' }}>Tổng SL Đặt</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '130px' }}>SL Xuất Giao Đợt Này</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dispatchItems.map((item, idx) => (
                          <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1e293b' }}>
                              {item.name}
                              {item.spec && <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>{item.spec}</div>}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>
                              {item.qty}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <input
                                type="number"
                                min="0"
                                max={item.qty}
                                value={item.dispatched_qty}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  setDispatchItems(prev => prev.map((it, i) => i === idx ? { ...it, dispatched_qty: val } : it));
                                }}
                                style={{
                                  width: '90px',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #0056A3',
                                  textAlign: 'center',
                                  fontWeight: 700,
                                  color: '#0056A3'
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Ghi chú đợt giao & Số phiếu xuất kho / Vận đơn đính kèm:
                    </label>
                    <textarea
                      rows={2}
                      className="form-control"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="Ghi chú số phiếu xuất kho, thông tin ký nhận..."
                      style={{ fontSize: '12px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setActiveTab('list')}
                    >
                      Hủy bỏ
                    </button>

                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={isLoading}
                      style={{ background: '#0056A3', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Send size={15} />
                      {isLoading ? 'Đang cập nhật...' : 'Xác nhận Xuất kho & Giao hàng'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* BẢNG KÊ HÀNG HÓA THÔNG THƯỜNG */
              <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0056A3' }}>
                    Danh mục mặt hàng của Quý NCC trong đơn hàng ({dispatchItems.length} món)
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Chế độ bảo mật: Chỉ hiển thị hàng hóa thuộc phạm vi cung cấp của Quý NCC
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '8px 12px', textAlign: 'center', width: '40px' }}>STT</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tên hàng hóa & Quy cách</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Đơn vị thụ hưởng</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', width: '70px' }}>SL</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', width: '110px' }}>Đơn giá</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', width: '130px' }}>Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dispatchItems.map((item, idx) => (
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>
                            {item.name}
                            {item.spec && <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>{item.spec}</div>}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#0056A3', fontWeight: 500 }}>
                            {item.unit || 'Hội sở'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>
                            {item.qty}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>
                            {formatNumber(item.price || 0)}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0056A3' }}>
                            {formatCurrency(item.amount || (Number(item.qty) * Number(item.price)) || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            Vui lòng chọn đơn hàng PO bên trái để thao tác.
          </div>
        )}
      </div>

      {/* MODAL HẸN NGÀY GIAO & XEM LỊCH SỬ THAY ĐỔI */}
      {showDateModal && (
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
              width: '650px',
              maxWidth: '95vw',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0056A3' }}>
                <Calendar size={18} />
                <span>Hẹn Ngày Giao Hàng & Lịch Sử Thay Đổi ({selectedPO?.poNumber || selectedPO?.po_number})</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExpectedDate} style={{ padding: '18px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Ngày dự kiến giao mới:
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={newExpectedDate}
                  onChange={(e) => setNewExpectedDate(e.target.value)}
                  required
                  style={{ fontSize: '13px', height: '36px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Lý do thay đổi / cam kết tiến độ:
                </label>
                <textarea
                  rows={2}
                  className="form-control"
                  placeholder="Vd: Nhà máy sản xuất hoàn tất sớm, hoặc xin dời 1 ngày do thời tiết..."
                  value={dateChangeReason}
                  onChange={(e) => setDateChangeReason(e.target.value)}
                  required
                  style={{ fontSize: '12px' }}
                />
              </div>

              {/* LỊCH SỬ THAY ĐỔI NGÀY GIAO (AI SỬA, LÚC NÀO, TỪ NGÀY NÀO SANG NGÀY NÀO) */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  <History size={14} color="#0056A3" />
                  <span>Lịch sử các lần thay đổi ngày giao ({dateHistory.length})</span>
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  {loadingHistory ? (
                    <div style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                      Đang tải lịch sử...
                    </div>
                  ) : dateHistory.length === 0 ? (
                    <div style={{ padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                      Chưa có lịch sử thay đổi ngày giao nào trước đây
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Người sửa</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>Từ ngày</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>Sang ngày</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Lý do</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Thời gian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dateHistory.map((h, i) => (
                          <tr key={h.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '6px 8px', fontWeight: 600 }}>{h.changed_by_name || 'NCC'}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b' }}>
                              {h.old_date ? new Date(h.old_date).toLocaleDateString('vi-VN') : '—'}
                            </td>
                            <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: '#0056A3' }}>
                              {h.new_date ? new Date(h.new_date).toLocaleDateString('vi-VN') : '—'}
                            </td>
                            <td style={{ padding: '6px 8px', color: '#334155' }}>{h.reason || '—'}</td>
                            <td style={{ padding: '6px 8px', color: '#94a3b8' }}>
                              {h.created_at ? new Date(h.created_at).toLocaleString('vi-VN') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowDateModal(false)}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isLoading}
                  style={{ background: '#0056A3' }}
                >
                  {isLoading ? 'Đang lưu...' : 'Lưu ngày hẹn mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
