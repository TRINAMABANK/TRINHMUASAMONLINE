import React, { useState, useEffect, useCallback } from 'react';
import { supplierPortalApi } from '../services/api/supplierPortalApi.js';
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
  X,
  Building,
  ShieldCheck,
  Download
} from 'lucide-react';

export function SupplierPortalPage({
  token: propToken = '',
  pos = [],
  currentUser = null,
  onRefreshPOs
}) {
  // 1. Nhận diện token bảo mật từ props hoặc URL
  const [token, setToken] = useState(() => {
    if (propToken) return propToken;
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/supplier-portal/')) {
        return path.replace('/supplier-portal/', '').split('/')[0].split('?')[0];
      }
      return new URLSearchParams(window.location.search).get('token') || '';
    }
    return '';
  });

  // State chế độ Cổng Đối Tác qua Token
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState('confirm'); // 'confirm' | 'dispatch' | 'history'

  // Form xác nhận đặt hàng
  const [expectedDate, setExpectedDate] = useState('');
  const [confirmNote, setConfirmNote] = useState('');
  const [confirmedByName, setConfirmedByName] = useState('');
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);
  const [confirmSuccessMsg, setConfirmSuccessMsg] = useState('');

  // Form xuất kho / giao hàng
  const [dispatchedAt, setDispatchedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [dispatcherName, setDispatcherName] = useState('');
  const [dispatchItemQtys, setDispatchItemQtys] = useState({});
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState(false);
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState('');

  // 2. Nạp dữ liệu qua Token bảo mật từ Backend
  const loadPortalData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await supplierPortalApi.getPortalData(token);
      if (res.success && res.data) {
        setPortalData(res.data);
        // Khởi tạo ngày dự kiến nếu đã có
        if (res.data.confirmation?.expected_delivery_date) {
          setExpectedDate(String(res.data.confirmation.expected_delivery_date).slice(0, 10));
        } else if (res.data.po?.expected_delivery_date) {
          setExpectedDate(String(res.data.po.expected_delivery_date).slice(0, 10));
        }
        // Khởi tạo số lượng xuất kho mặc định = số lượng còn lại
        const initialQtys = {};
        (res.data.items || []).forEach(it => {
          initialQtys[it.id] = it.remainingQty || 0;
        });
        setDispatchItemQtys(initialQtys);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Không thể xác thực liên kết đối tác.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadPortalData();
    }
  }, [token, loadPortalData]);

  // 3. Xử lý Chức năng 1: Xác nhận đơn đặt hàng
  const handleConfirmOrder = async (e) => {
    e.preventDefault();
    if (!expectedDate) {
      alert('Vui lòng chọn Ngày dự kiến giao hàng.');
      return;
    }
    setIsSubmittingConfirm(true);
    setConfirmSuccessMsg('');
    try {
      const res = await supplierPortalApi.confirmPo(token, {
        expected_delivery_date: expectedDate,
        note: confirmNote,
        confirmed_by_name: confirmedByName || portalData?.supplier?.name
      });
      if (res.success) {
        setConfirmSuccessMsg('Quý Công ty đã xác nhận đơn đặt hàng thành công!');
        await loadPortalData();
        setTimeout(() => setConfirmSuccessMsg(''), 4000);
      }
    } catch (err) {
      alert(`Lỗi xác nhận: ${err.message}`);
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  // 4. Xử lý Chức năng 2: Xác nhận đã xuất kho / giao hàng
  const handleDispatchDelivery = async (e) => {
    e.preventDefault();
    const deliveredItems = [];
    (portalData?.items || []).forEach(it => {
      const qty = Number(dispatchItemQtys[it.id] || 0);
      if (qty > 0) {
        deliveredItems.push({
          po_item_id: it.id,
          quantity_delivered: qty,
          note: `Xuất kho mặt hàng ${it.item_name || ''}`
        });
      }
    });

    if (deliveredItems.length === 0) {
      alert('Vui lòng nhập số lượng thực tế xuất kho (> 0) cho ít nhất một mặt hàng.');
      return;
    }

    setIsSubmittingDispatch(true);
    setDispatchSuccessMsg('');
    try {
      const res = await supplierPortalApi.dispatchDelivery(token, {
        dispatched_at: dispatchedAt,
        delivered_items: deliveredItems,
        delivery_note: deliveryNote,
        tracking_number: trackingNumber,
        carrier: carrier,
        confirmed_by_name: dispatcherName || portalData?.supplier?.name
      });

      if (res.success) {
        setDispatchSuccessMsg(`Xác nhận xuất kho thành công! (${res.deliveryCode})`);
        setDeliveryNote('');
        setTrackingNumber('');
        await loadPortalData();
        setActiveTab('history');
        setTimeout(() => setDispatchSuccessMsg(''), 5000);
      }
    } catch (err) {
      alert(`Lỗi xuất kho: ${err.message}`);
    } finally {
      setIsSubmittingDispatch(false);
    }
  };

  // =========================================================================
  // GIAO DIỆN CỔNG ĐỐI TÁC RIÊNG BIỆT (KHÔNG CÓ MENU QUẢN TRỊ ADMIN)
  // =========================================================================

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spin" style={{ width: '40px', height: '40px', border: '4px solid #0056A3', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 16px' }} />
          <h3 style={{ color: '#003366', margin: 0 }}>Đang kiểm tra liên kết bảo mật đối tác...</h3>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>Hệ thống Quản lý Mua sắm Nam A Bank</p>
        </div>
      </div>
    );
  }

  // Trường hợp Link lỗi / hết hạn / bị thu hồi
  if (errorMessage) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ maxWidth: '520px', width: '100%', background: '#ffffff', borderRadius: '12px', padding: '36px', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <AlertCircle size={36} />
          </div>
          <h2 style={{ color: '#991b1b', margin: '0 0 12px', fontSize: '20px', fontWeight: 700 }}>
            Không Thể Truy Cập Cổng Đối Tác
          </h2>
          <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.6, margin: '0 0 20px' }}>
            {errorMessage}
          </p>
          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', color: '#334155', textAlign: 'left', lineHeight: 1.5 }}>
            <strong>Đầu mối hỗ trợ Nam A Bank:</strong><br />
            • Cán bộ phụ trách: <strong>Mr. Trí</strong><br />
            • Số điện thoại: <strong>0982441446</strong><br />
            • Email: admin@namabank.com.vn
          </div>
        </div>
      </div>
    );
  }

  if (!portalData) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        Chưa tìm thấy dữ liệu liên kết đối tác. Vui lòng kiểm tra lại đường link từ email.
      </div>
    );
  }

  const { po, supplier, items = [], confirmation, deliveries = [] } = portalData;
  const isConfirmed = Boolean(confirmation || po.status === 'SUPPLIER_CONFIRMED');

  return (
    <div className="standalone-supplier-portal" style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Inter', sans-serif" }}>
      {/* 1. Header Nhận diện Nam A Bank */}
      <header style={{ background: '#003366', color: '#ffffff', borderBottom: '3px solid #d4af37', padding: '16px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#d4af37', color: '#003366', padding: '8px', borderRadius: '6px', display: 'flex' }}>
              <Building size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '0.5px' }}>
                NAM A BANK – CỔNG ĐỐI TÁC NHÀ CUNG CẤP
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#cbd5e1' }}>
                Tiếp nhận đơn đặt hàng • Xác nhận giao hàng • Quản lý vòng đời đơn PO
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '20px', fontSize: '13px' }}>
            <ShieldCheck size={16} color="#4ade80" />
            <span>Liên kết xác thực bảo mật</span>
          </div>
        </div>
      </header>

      {/* 2. Container Nội dung chính */}
      <main style={{ maxWidth: '1100px', margin: '24px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Banner Tổng quan PO & Nhà cung cấp */}
        <div style={{ background: '#ffffff', borderRadius: '10px', padding: '20px 24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0056A3', textTransform: 'uppercase' }}>
                ĐƠN ĐẶT HÀNG CHÍNH THỨC
              </span>
              <h2 style={{ margin: '4px 0 6px', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
                PO: {po.poNumber}
              </h2>
              <div style={{ fontSize: '13px', color: '#475569' }}>
                Ngày phát hành: <strong>{po.orderDate ? new Date(po.orderDate).toLocaleDateString('vi-VN') : '—'}</strong>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 18px', minWidth: '280px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                ĐƠN VỊ CUNG CẤP HÀNG HÓA
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#003366', marginTop: '4px' }}>
                {supplier.name}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Mã NCC: <strong>{supplier.code}</strong> {supplier.taxCode ? `• MST: ${supplier.taxCode}` : ''}
              </div>
            </div>
          </div>

          {/* Trạng thái hiện tại */}
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '13px' }}>
            <div>
              Trạng thái đơn: <strong style={{ color: isConfirmed ? '#15803d' : '#b45309' }}>
                {isConfirmed ? '✓ Đã xác nhận đơn hàng' : '⏳ Chờ Quý Công ty xác nhận'}
              </strong>
            </div>
            {confirmation?.expected_delivery_date && (
              <div style={{ color: '#0369a1' }}>
                Ngày dự kiến giao: <strong>{new Date(confirmation.expected_delivery_date).toLocaleDateString('vi-VN')}</strong>
              </div>
            )}
            <div>
              Trạng thái giao: <strong style={{ color: po.deliveryStatus === 'DA_GIAO_DU' ? '#15803d' : '#d97706' }}>
                {po.deliveryStatus === 'DA_GIAO_DU' ? 'Đã giao đủ 100%' : po.deliveryStatus === 'XUAT_KHO_MOT_PHAN' ? 'Đã xuất kho một phần' : 'Chưa giao hàng'}
              </strong>
            </div>
          </div>
        </div>

        {/* Bảng Danh sách hàng hóa đặt hàng (9 cột thông tin bắt buộc) */}
        <div style={{ background: '#ffffff', borderRadius: '10px', padding: '20px 24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#003366' }}>
              Danh Sách Hàng Hóa Thuộc Đơn Đặt Hàng ({items.length} mặt hàng)
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
              * Số lượng và đơn giá được quy định bởi Nam A Bank, đối tác không được chỉnh sửa.
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>
                  <th style={{ padding: '10px 8px', width: '45px', textAlign: 'center' }}>STT</th>
                  <th style={{ padding: '10px 12px' }}>Tên Hàng Hóa / Vật Tư</th>
                  <th style={{ padding: '10px 12px' }}>Quy Cách / Thông Số</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', width: '70px' }}>ĐVT</th>
                  <th style={{ padding: '10px 10px', textAlign: 'right', width: '90px' }}>SL Đặt</th>
                  <th style={{ padding: '10px 10px', textAlign: 'right', width: '90px', color: '#15803d' }}>Đã Giao</th>
                  <th style={{ padding: '10px 10px', textAlign: 'right', width: '90px', color: '#b91c1c' }}>Còn Lại</th>
                  <th style={{ padding: '10px 12px', width: '180px' }}>Đơn Vị Nhận Hàng</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{it.item_name || 'Hàng hóa'}</td>
                    <td style={{ padding: '10px 12px', color: '#475569', fontSize: '12px' }}>{it.specification || '—'}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>{it.unit || 'Cái'}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>{it.orderedQty}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: '#15803d' }}>{it.deliveredQty}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: it.remainingQty > 0 ? '#b91c1c' : '#15803d' }}>
                      {it.remainingQty}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#334155' }}>
                      {it.unit_name || 'Hội sở / Chi nhánh'}<br />
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{it.unit_address || ''}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Thanh chuyển đổi chức năng */}
        <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={() => setActiveTab('confirm')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === 'confirm' ? '3px solid #0056A3' : '3px solid transparent',
              background: activeTab === 'confirm' ? '#ffffff' : 'transparent',
              color: activeTab === 'confirm' ? '#0056A3' : '#64748b',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '6px 6px 0 0'
            }}
          >
            <CheckCircle2 size={16} />
            1. Xác Nhận Đơn Hàng & Ngày Dự Kiến Giao
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dispatch')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === 'dispatch' ? '3px solid #0056A3' : '3px solid transparent',
              background: activeTab === 'dispatch' ? '#ffffff' : 'transparent',
              color: activeTab === 'dispatch' ? '#0056A3' : '#64748b',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '6px 6px 0 0'
            }}
          >
            <Truck size={16} />
            2. Xác Nhận Xuất Kho & Báo Giao Hàng (Nhiều Đợt)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === 'history' ? '3px solid #0056A3' : '3px solid transparent',
              background: activeTab === 'history' ? '#ffffff' : 'transparent',
              color: activeTab === 'history' ? '#0056A3' : '#64748b',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '6px 6px 0 0'
            }}
          >
            <History size={16} />
            3. Lịch Sử Các Đợt Giao Hàng ({deliveries.length})
          </button>
        </div>

        {/* TAB 1: XÁC NHẬN ĐƠN ĐẶT HÀNG & HẸN NGÀY DỰ KIẾN GIAO */}
        {activeTab === 'confirm' && (
          <div style={{ background: '#ffffff', borderRadius: '10px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#003366' }}>
              Xác Nhận Đơn Đặt Hàng & Cập Nhật Thời Gian Dự Kiến Giao
            </h3>

            {confirmSuccessMsg && (
              <div style={{ padding: '12px 16px', background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '6px', marginBottom: '16px', fontWeight: 600 }}>
                {confirmSuccessMsg}
              </div>
            )}

            <form onSubmit={handleConfirmOrder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Thời gian dự kiến giao hàng <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Nhập ngày Quý Công ty dự kiến bàn giao hàng hóa tại các địa điểm nhận
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Người đại diện xác nhận (Họ tên / Chức danh)
                  </label>
                  <input
                    type="text"
                    value={confirmedByName}
                    onChange={(e) => setConfirmedByName(e.target.value)}
                    placeholder={`Ví dụ: Nguyễn Văn A - Đại diện ${supplier.name}`}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Ghi chú hoặc cam kết tiến độ giao hàng (nếu có)
                </label>
                <textarea
                  rows={3}
                  value={confirmNote}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  placeholder="Nhập ghi chú hoặc thông tin bổ sung gửi cho Nam A Bank..."
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={isSubmittingConfirm}
                  style={{
                    padding: '10px 24px',
                    background: '#0056A3',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <CheckCircle2 size={16} />
                  {isSubmittingConfirm ? 'Đang xử lý...' : isConfirmed ? 'Cập Nhật Lại Ngày Dự Kiến' : 'Xác Nhận Đồng Ý Đặt Hàng'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: XÁC NHẬN XUẤT KHO & GIAO HÀNG (HỖ TRỢ NHIỀU ĐỢT) */}
        {activeTab === 'dispatch' && (
          <div style={{ background: '#ffffff', borderRadius: '10px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#003366' }}>
              Xác Nhận Xuất Kho & Khởi Tạo Đợt Giao Hàng
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#64748b' }}>
              Hệ thống hỗ trợ giao nhiều đợt. Quý Công ty nhập số lượng thực tế giao đợt này cho từng mặt hàng bên dưới.
            </p>

            {dispatchSuccessMsg && (
              <div style={{ padding: '12px 16px', background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '6px', marginBottom: '16px', fontWeight: 600 }}>
                {dispatchSuccessMsg}
              </div>
            )}

            <form onSubmit={handleDispatchDelivery} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Bảng nhập số lượng giao đợt này */}
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '8px 10px', width: '40px', textAlign: 'center' }}>STT</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Tên Mặt Hàng</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Tổng Đặt</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px', color: '#15803d' }}>Đã Giao</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px', color: '#b91c1c' }}>Còn Lại</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '140px', background: '#eff6ff', color: '#1d4ed8' }}>
                        SL Xuất Kho Đợt Này
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={it.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{it.item_name}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{it.orderedQty}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#15803d', fontWeight: 600 }}>{it.deliveredQty}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#b91c1c', fontWeight: 700 }}>{it.remainingQty}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', background: '#eff6ff' }}>
                          <input
                            type="number"
                            min={0}
                            max={it.remainingQty}
                            value={dispatchItemQtys[it.id] ?? 0}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(it.remainingQty, Number(e.target.value)));
                              setDispatchItemQtys(prev => ({ ...prev, [it.id]: val }));
                            }}
                            style={{
                              width: '80px',
                              padding: '6px 8px',
                              textAlign: 'right',
                              fontWeight: 700,
                              fontSize: '13px',
                              border: '1px solid #93c5fd',
                              borderRadius: '4px'
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Thông tin vận chuyển */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Ngày xuất kho / Ngày giao hàng thực tế <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dispatchedAt}
                    onChange={(e) => setDispatchedAt(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Đơn vị vận chuyển (Carrier)
                  </label>
                  <input
                    type="text"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder="Ví dụ: Đội xe FTI / Viettel Post / GHN"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Mã vận đơn / Số phiếu xuất kho
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Ví dụ: PXK-2026-001 hoặc Mã bưu gửi"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Người xác nhận xuất kho
                  </label>
                  <input
                    type="text"
                    value={dispatcherName}
                    onChange={(e) => setDispatcherName(e.target.value)}
                    placeholder="Họ tên thủ kho / cán bộ giao vận"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Ghi chú đợt giao hàng
                </label>
                <textarea
                  rows={2}
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="Ghi chú đính kèm chứng từ hoặc liên hệ tài xế..."
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="submit"
                  disabled={isSubmittingDispatch}
                  style={{
                    padding: '10px 24px',
                    background: '#15803d',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Truck size={16} />
                  {isSubmittingDispatch ? 'Đang lưu...' : 'Xác Nhận Xuất Kho / Giao Hàng Đợt Này'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: LỊCH SỬ CÁC ĐỢT GIAO HÀNG */}
        {activeTab === 'history' && (
          <div style={{ background: '#ffffff', borderRadius: '10px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#003366' }}>
              Lịch Sử Các Đợt Giao Hàng Của Nhà Cung Cấp ({deliveries.length} đợt)
            </h3>

            {deliveries.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                Chưa có đợt giao hàng nào được ghi nhận. Vui lòng chuyển sang Tab 2 để báo xuất kho.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {deliveries.map((deliv, idx) => (
                  <div key={deliv.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                          Đợt {deliveries.length - idx}: {deliv.delivery_code}
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: '#dcfce7', color: '#15803d' }}>
                          {deliv.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Ngày giao: <strong>{deliv.delivery_date ? new Date(deliv.delivery_date).toLocaleDateString('vi-VN') : '—'}</strong>
                      </div>
                    </div>

                    <div style={{ fontSize: '12px', color: '#475569', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {deliv.carrier && <span>Đơn vị vận chuyển: <strong>{deliv.carrier}</strong></span>}
                      {deliv.tracking_number && <span>Mã vận đơn: <strong>{deliv.tracking_number}</strong></span>}
                      {deliv.confirmed_by && <span>Người xác nhận: <strong>{deliv.confirmed_by}</strong></span>}
                    </div>

                    {deliv.delivery_note && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#334155', fontStyle: 'italic', background: '#ffffff', padding: '6px 10px', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
                        "{deliv.delivery_note}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer bảo mật */}
      <footer style={{ marginTop: '40px', padding: '20px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', borderTop: '1px solid #e2e8f0' }}>
        © 2026 Ngân Hàng TMCP Nam Á (Nam A Bank). Hệ thống Quản trị Tài sản & Mua sắm nội bộ.
      </footer>
    </div>
  );
}

export default SupplierPortalPage;
