import React, { useState, useEffect, useMemo } from 'react';
import { receiptApi } from '../services/api/lifecycleApi.js';
import { formatCurrency, formatNumber } from '../utils/currencyUtils.js';
import {
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileText,
  ShieldCheck,
  AlertOctagon,
  Camera,
  Paperclip,
  Check,
  X,
  History,
  Lock
} from 'lucide-react';

const CONDITION_OPTIONS = [
  { value: 'DA_NHAN_DU', label: '1. Đã nhận đủ, nguyên vẹn', color: '#166534', bg: '#dcfce7' },
  { value: 'NHAN_THIEU', label: '2. Nhận thiếu số lượng', color: '#b45309', bg: '#fef3c7' },
  { value: 'NHAN_THUA', label: '3. Nhận thừa số lượng', color: '#0369a1', bg: '#e0f2fe' },
  { value: 'HU_HONG', label: '4. Hàng hư hỏng / trầy xước / bể vỡ', color: '#dc2626', bg: '#fee2e2' },
  { value: 'GIAO_SAI', label: '5. Giao sai quy cách / chủng loại', color: '#b91c1c', bg: '#fecaca' },
  { value: 'CHUA_NHAN', label: '6. Chưa nhận được hàng', color: '#64748b', bg: '#f1f5f9' }
];

export function ReceiptConfirmationPage({ pos = [], preselectedPOId, currentUser, onRefreshPOs, onNavigateToPO }) {
  const [selectedPOId, setSelectedPOId] = useState(preselectedPOId || '');
  const [receiverName, setReceiverName] = useState(currentUser?.full_name || 'Cán bộ Đơn vị thụ hưởng');
  const [generalCondition, setGeneralCondition] = useState('DA_NHAN_DU');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptItems, setReceiptItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [pastReceipts, setPastReceipts] = useState([]);
  const [loadingPastReceipts, setLoadingPastReceipts] = useState(false);

  // Đối soát ngoại lệ (dành cho QTTS / ADMIN)
  const [resolveModalReceipt, setResolveModalReceipt] = useState(null);
  const [resolveNote, setResolveNote] = useState('');
  const [closePoCheckbox, setClosePoCheckbox] = useState(true);

  // Tìm PO đang chọn
  const selectedPO = useMemo(() => {
    return pos.find(p => p.id === selectedPOId) || null;
  }, [pos, selectedPOId]);

  // Cập nhật khi preselectedPOId thay đổi
  useEffect(() => {
    if (preselectedPOId) {
      setSelectedPOId(preselectedPOId);
    } else if (pos.length > 0 && !selectedPOId) {
      setSelectedPOId(pos[0].id);
    }
  }, [preselectedPOId, pos]);

  // Khởi tạo các item nhận khi chọn PO
  useEffect(() => {
    if (selectedPO) {
      const items = (selectedPO.items || []).map(item => {
        const ordered = Number(item.qty) || 0;
        const currentReceived = Number(item.received_qty) || 0;
        const remaining = Math.max(0, ordered - currentReceived);

        return {
          po_item_id: item.id,
          name: item.name,
          spec: item.spec,
          unit: item.unit || item.unit_name || 'Hội sở',
          ordered_qty: ordered,
          delivered_qty: ordered, // Giả định NCC xuất giao đợt này
          actual_received_qty: remaining > 0 ? remaining : ordered, // Mặc định điền số lượng còn lại
          condition_status: 'DA_NHAN_DU',
          note: ''
        };
      });
      setReceiptItems(items);

      // Tải biên bản nhận hàng quá khứ từ backend
      setLoadingPastReceipts(true);
      receiptApi.getReceipts(selectedPO.id)
        .then(res => {
          if (res.success && Array.isArray(res.data)) {
            setPastReceipts(res.data);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingPastReceipts(false));
    }
  }, [selectedPO]);

  // Cập nhật từng item
  const updateItemField = (idx, field, val) => {
    setReceiptItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: val };

      // Tự động suy ra tình trạng nếu số lượng nhận < đặt
      if (field === 'actual_received_qty') {
        const numVal = Number(val) || 0;
        if (numVal < item.ordered_qty) {
          updated.condition_status = 'NHAN_THIEU';
        } else if (numVal > item.ordered_qty) {
          updated.condition_status = 'NHAN_THUA';
        } else {
          updated.condition_status = 'DA_NHAN_DU';
        }
      }
      return updated;
    }));
  };

  // Tính toán kiểm tra ngoại lệ
  const discrepancyCheck = useMemo(() => {
    let hasShortage = false;
    let hasDamage = false;
    let hasWrongItem = false;
    let hasDiscrepancy = false;

    receiptItems.forEach(it => {
      const ord = Number(it.ordered_qty) || 0;
      const rec = Number(it.actual_received_qty) || 0;
      if (rec < ord || it.condition_status === 'NHAN_THIEU') {
        hasShortage = true;
        hasDiscrepancy = true;
      }
      if (it.condition_status === 'HU_HONG') {
        hasDamage = true;
        hasDiscrepancy = true;
      }
      if (it.condition_status === 'GIAO_SAI') {
        hasWrongItem = true;
        hasDiscrepancy = true;
      }
      if (it.condition_status === 'NHAN_THUA') {
        hasDiscrepancy = true;
      }
    });

    return {
      hasDiscrepancy: hasDiscrepancy || generalCondition !== 'DA_NHAN_DU',
      hasShortage,
      hasDamage,
      hasWrongItem
    };
  }, [receiptItems, generalCondition]);

  // Kiểm tra điều kiện đóng PO: Chưa thể đóng PO nếu còn thiếu hàng hoặc có ngoại lệ chưa giải quyết
  const unresolvedDiscrepancyCount = pastReceipts.filter(r => r.has_discrepancy && !r.is_resolved).length;
  const canClosePO = !discrepancyCheck.hasDiscrepancy && unresolvedDiscrepancyCount === 0;

  // Gửi xác nhận nhận hàng
  const handleSubmitReceipt = async (e) => {
    e.preventDefault();
    if (!selectedPO) return;

    if (!window.confirm('Xác nhận hoàn tất biên bản kiểm đếm nhận hàng này?')) return;

    setIsLoading(true);
    try {
      const payload = {
        receiver_name: receiverName,
        condition_status: discrepancyCheck.hasDiscrepancy ? (discrepancyCheck.hasDamage ? 'HU_HONG' : discrepancyCheck.hasWrongItem ? 'GIAO_SAI' : 'NHAN_THIEU') : 'DA_NHAN_DU',
        notes: receiptNotes,
        items: receiptItems.map(it => ({
          po_item_id: it.po_item_id,
          ordered_qty: it.ordered_qty,
          delivered_qty: it.delivered_qty,
          actual_received_qty: it.actual_received_qty,
          condition_status: it.condition_status,
          note: it.note
        }))
      };

      const res = await receiptApi.confirmReceipt(selectedPO.id, payload);
      if (res.success) {
        setSuccessMessage('Đã lưu biên bản xác nhận nhận hàng thành công!');
        if (onRefreshPOs) onRefreshPOs();
        // Tải lại lịch sử biên bản
        const rRes = await receiptApi.getReceipts(selectedPO.id);
        if (rRes.success && Array.isArray(rRes.data)) setPastReceipts(rRes.data);
      }
    } catch (err) {
      alert(`Lỗi xác nhận nhận hàng: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // QTTS xử lý giải quyết ngoại lệ
  const handleResolveDiscrepancy = async (e) => {
    e.preventDefault();
    if (!resolveModalReceipt) return;

    setIsLoading(true);
    try {
      const res = await receiptApi.resolveDiscrepancy(resolveModalReceipt.id, resolveNote, closePoCheckbox);
      if (res.success) {
        alert('Đã ghi nhận xử lý ngoại lệ và cập nhật trạng thái PO thành công!');
        setResolveModalReceipt(null);
        setResolveNote('');
        if (onRefreshPOs) onRefreshPOs();
        // Tải lại lịch sử
        const rRes = await receiptApi.getReceipts(selectedPO.id);
        if (rRes.success && Array.isArray(rRes.data)) setPastReceipts(rRes.data);
      }
    } catch (err) {
      alert(`Lỗi xử lý ngoại lệ: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-container receipt-confirmation-page">
      {/* Banner Cổng Xác nhận nhận hàng */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0056A3 0%, #15803d 100%)',
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
            <PackageCheck size={26} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#FFD200', fontWeight: 700 }}>
              CỔNG NGHIỆM THU • GIAO NHẬN TẬN NƠI
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '2px 0 4px' }}>
              Xác Nhận Nhận Hàng & Kiểm Đếm Hàng Hóa Thực Tế
            </h1>
            <p style={{ fontSize: '13px', opacity: 0.9 }}>
              Dành cho Chi nhánh, Phòng Giao Dịch, OneBank hoặc Cán bộ QTTS xác nhận tình trạng hàng hóa bàn giao.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', padding: '10px 14px', borderRadius: '6px', fontSize: '12px' }}>
            <div>Người kiểm nhận: <strong>{receiverName}</strong></div>
            <div style={{ opacity: 0.8, fontSize: '11px' }}>Vai trò: {currentUser?.role || 'Cán bộ Đơn vị'}</div>
          </div>
        </div>
      </div>

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

      {/* Chọn hồ sơ PO cần xác nhận */}
      <div
        style={{
          background: '#ffffff',
          padding: '14px 18px',
          borderRadius: '8px',
          border: '1px solid #dce4ee',
          marginBottom: '20px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ fontWeight: 700, color: '#0056A3', fontSize: '13px', minWidth: '160px' }}>
          Chọn hồ sơ PO cần nhận:
        </div>

        <div style={{ flex: 1, minWidth: '280px' }}>
          <select
            className="form-control"
            value={selectedPOId}
            onChange={(e) => setSelectedPOId(e.target.value)}
            style={{ fontSize: '13px', height: '38px', fontWeight: 600, color: '#0056A3' }}
          >
            {pos.map(po => (
              <option key={po.id} value={po.id}>
                {po.poNumber || po.po_number} - {po.title || 'Hồ sơ mua sắm'} ({formatCurrency(po.totalAmount || po.total_amount || 0)})
              </option>
            ))}
          </select>
        </div>

        {selectedPO && (
          <div style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
            <span style={{ padding: '6px 10px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
              Giao nhận: {selectedPO.delivery_status || 'DANG_GIAO'}
            </span>
          </div>
        )}
      </div>

      {selectedPO ? (
        <form onSubmit={handleSubmitReceipt}>
          {/* CẢNH BÁO BẤT THƯỜNG / QUY TẮC ĐÓNG PO */}
          {discrepancyCheck.hasDiscrepancy ? (
            <div
              style={{
                marginBottom: '20px',
                padding: '14px 18px',
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: '8px',
                color: '#9f1239',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}
            >
              <AlertTriangle size={22} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px' }}>
                <strong style={{ fontSize: '14px' }}>CẢNH BÁO: PHÁT HIỆN BẤT THƯỜNG / CHÊNH LỆCH GIAO NHẬN</strong>
                <div style={{ marginTop: '4px' }}>
                  Hệ thống ghi nhận: {discrepancyCheck.hasShortage && '• Hàng nhận thiếu so với số lượng đặt. '}
                  {discrepancyCheck.hasDamage && '• Có mặt hàng bị hư hỏng / bể vỡ. '}
                  {discrepancyCheck.hasWrongItem && '• Có mặt hàng giao sai quy cách. '}
                </div>
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#be123c', fontWeight: 600 }}>
                  <Lock size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Quy tắc nghiệp vụ: Hồ sơ PO sẽ KHÔNG ĐƯỢC PHÉP ĐÓNG (COMPLETED) khi còn thiếu hàng hoặc ngoại lệ chưa được QTTS xử lý dứt điểm.
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                marginBottom: '20px',
                padding: '12px 18px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <CheckCircle2 size={18} color="#16a34a" />
              <span>Số lượng thực nhận khớp 100% với số lượng đặt và hàng hóa nguyên vẹn. Sẵn sàng hoàn tất đóng hồ sơ.</span>
            </div>
          )}

          {/* BẢNG KIỂM ĐẾM CHI TIẾT TỪNG MÓN HÀNG */}
          <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0056A3' }}>
                Kiểm đếm chi tiết từng mặt hàng ({receiptItems.length} món)
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Nhập số lượng thực nhận & đánh giá tình trạng
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '40px' }}>STT</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Tên hàng hóa & Quy cách</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Đơn vị thụ hưởng</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '80px' }}>SL Đặt</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '80px' }}>SL NCC giao</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '110px' }}>SL Thực nhận</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', width: '220px' }}>Tình trạng hàng hóa</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', width: '180px' }}>Ghi chú kiểm đếm</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptItems.map((item, idx) => {
                    const isDiscrepancy = Number(item.actual_received_qty) < Number(item.ordered_qty) || item.condition_status !== 'DA_NHAN_DU';

                    return (
                      <tr
                        key={item.po_item_id || idx}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: isDiscrepancy ? '#fff5f5' : '#ffffff'
                        }}
                      >
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>

                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.name}</div>
                          {item.spec && <div style={{ fontSize: '11px', color: '#64748b' }}>{item.spec}</div>}
                        </td>

                        <td style={{ padding: '10px 12px', color: '#0056A3', fontWeight: 500 }}>
                          {item.unit}
                        </td>

                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                          {item.ordered_qty}
                        </td>

                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#0056A3', fontWeight: 600 }}>
                          {item.delivered_qty}
                        </td>

                        {/* Input SL Thực nhận */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            max="999"
                            value={item.actual_received_qty}
                            onChange={(e) => updateItemField(idx, 'actual_received_qty', e.target.value)}
                            style={{
                              width: '80px',
                              padding: '5px 8px',
                              borderRadius: '4px',
                              border: isDiscrepancy ? '2px solid #ef4444' : '1px solid #0056A3',
                              textAlign: 'center',
                              fontWeight: 700,
                              fontSize: '13px',
                              color: isDiscrepancy ? '#dc2626' : '#15803d'
                            }}
                          />
                        </td>

                        {/* Dropdown 6 Tình trạng hàng hóa chuẩn */}
                        <td style={{ padding: '10px 12px' }}>
                          <select
                            className="form-control"
                            value={item.condition_status}
                            onChange={(e) => updateItemField(idx, 'condition_status', e.target.value)}
                            style={{
                              fontSize: '11px',
                              padding: '4px 6px',
                              fontWeight: 600,
                              color: CONDITION_OPTIONS.find(c => c.value === item.condition_status)?.color || '#1e293b'
                            }}
                          >
                            {CONDITION_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Ghi chú phản ánh nếu có sai lệch */}
                        <td style={{ padding: '10px 12px' }}>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Ghi chú sai lệch (nếu có)..."
                            value={item.note}
                            onChange={(e) => updateItemField(idx, 'note', e.target.value)}
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* THÔNG TIN BIÊN BẢN & ĐÍNH KÈM */}
          <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '18px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Họ và tên Cán bộ nghiệm thu nhận hàng:
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  required
                  style={{ fontSize: '13px', height: '36px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Đính kèm Ảnh chụp thực tế & Biên bản giao nhận 2 bên:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => alert('Mô phỏng đính kèm: Đã tải lên file "BBGN_DA_KY_HAI_BEN.pdf" và 2 ảnh chụp hàng hóa!')}
                    style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Camera size={15} color="#0056A3" />
                    Chụp / Tải ảnh thực tế
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => alert('Mô phỏng đính kèm: Đã tải lên "BIEN_BAN_GIAO_NHAN_SCAN.pdf"')}
                    style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Paperclip size={15} color="#0056A3" />
                    Đính kèm biên bản PDF
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Ghi chú chung của biên bản bàn giao nhận hàng:
              </label>
              <textarea
                rows={2}
                className="form-control"
                placeholder="Nhập thông tin tình trạng niêm phong thùng hàng, thời gian bàn giao, xác nhận của đại diện đôi bên..."
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                style={{ fontSize: '12px' }}
              />
            </div>
          </div>

          {/* NÚT SUBMIT BIÊN BẢN */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '24px' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading}
              style={{
                background: discrepancyCheck.hasDiscrepancy ? '#d97706' : '#15803d',
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle2 size={18} />
              {isLoading ? 'Đang ghi nhận...' : discrepancyCheck.hasDiscrepancy ? 'LƯU BIÊN BẢN (CÓ BẤT THƯỜNG / CHỜ QTTS XỬ LÝ)' : 'XÁC NHẬN NHẬN HÀNG ĐỦ & HOÀN TẤT'}
            </button>
          </div>
        </form>
      ) : null}

      {/* KHU VỰC DÀNH CHO QTTS / ADMIN: LỊCH SỬ BIÊN BẢN & ĐỐI SOÁT NGOẠI LỆ */}
      {selectedPO && (
        <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0056A3', fontSize: '13px' }}>
              <History size={16} />
              <span>Lịch sử các lần lập biên bản nhận hàng của PO này ({pastReceipts.length})</span>
            </div>

            {['ADMIN', 'QTTS'].includes(currentUser?.role || 'QTTS') && (
              <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                Khu vực phân quyền QTTS: Xử lý đối soát ngoại lệ
              </span>
            )}
          </div>

          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {loadingPastReceipts ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                Đang tải lịch sử biên bản...
              </div>
            ) : pastReceipts.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                Chưa có biên bản nhận hàng nào được lưu trong cơ sở dữ liệu.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Mã biên bản</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Người nhận</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Thời gian</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Tình trạng</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Ghi chú</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Thao tác QTTS</th>
                  </tr>
                </thead>
                <tbody>
                  {pastReceipts.map((rc) => (
                    <tr key={rc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0056A3' }}>{rc.receipt_code}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{rc.receiver_name}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>
                        {rc.received_date ? new Date(rc.received_date).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, background: rc.has_discrepancy ? (rc.is_resolved ? '#ecfdf5' : '#fee2e2') : '#dcfce7', color: rc.has_discrepancy ? (rc.is_resolved ? '#047857' : '#b91c1c') : '#166534' }}>
                          {rc.has_discrepancy ? (rc.is_resolved ? 'Ngoại lệ đã giải quyết' : 'CÓ NGOẠI LỆ / CHƯA XỬ LÝ') : 'Nhận đủ'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#334155' }}>
                        {rc.notes || '—'}
                        {rc.resolution_note && (
                          <div style={{ fontSize: '11px', color: '#059669', marginTop: '2px' }}>
                            ✓ QTTS xử lý: {rc.resolution_note}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {rc.has_discrepancy && !rc.is_resolved && ['ADMIN', 'QTTS'].includes(currentUser?.role || 'QTTS') ? (
                          <button
                            type="button"
                            className="btn-sm btn-secondary"
                            onClick={() => { setResolveModalReceipt(rc); setResolveNote(''); }}
                            style={{ fontSize: '11px', padding: '3px 8px', color: '#b91c1c', border: '1px solid #fca5a5' }}
                          >
                            Xử lý ngoại lệ
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODAL QTTS XỬ LÝ NGOẠI LỆ ĐỐI SOÁT */}
      {resolveModalReceipt && (
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
              width: '560px',
              maxWidth: '95vw',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0056A3' }}>
                <ShieldCheck size={18} />
                <span>QTTS Xử Lý Ngoại Lệ Biên Bản {resolveModalReceipt.receipt_code}</span>
              </div>
              <button
                type="button"
                onClick={() => setResolveModalReceipt(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResolveDiscrepancy} style={{ padding: '18px' }}>
              <div style={{ marginBottom: '14px', fontSize: '13px', color: '#475569' }}>
                Biên bản ghi nhận: <strong>{resolveModalReceipt.condition_status}</strong> bởi <strong>{resolveModalReceipt.receiver_name}</strong>.
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Phương án xử lý / Ghi chú đối soát của QTTS:
                </label>
                <textarea
                  rows={3}
                  className="form-control"
                  placeholder="Vd: NCC đã đổi mới 1 máy in bị trầy xước, hoặc NCC đã hoàn bù số lượng thiếu vào ngày hôm sau..."
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  required
                  style={{ fontSize: '12px' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={closePoCheckbox}
                    onChange={(e) => setClosePoCheckbox(e.target.checked)}
                  />
                  <span>Đồng thời đóng hồ sơ PO (chuyển sang trạng thái <strong>HOAN_TAT</strong>)</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setResolveModalReceipt(null)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isLoading}
                  style={{ background: '#15803d' }}
                >
                  {isLoading ? 'Đang cập nhật...' : 'Xác nhận Đã Giải Quyết'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
