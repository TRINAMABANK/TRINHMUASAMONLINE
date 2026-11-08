import React, { useState, useMemo, useEffect } from 'react';
import { excelExporter } from '../services/excelExporter.js';
import {
  getSupplierInfo,
  generateSupplierLink,
  generateOrderEmailTemplate
} from '../utils/supplierDirectory.js';
import {
  Mail,
  FileSpreadsheet,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Send,
  X,
  Building,
  Check,
  Download,
  Share2
} from 'lucide-react';

export function OrderEmailModal({ isOpen, onClose, po, onConfirmSent }) {
  if (!isOpen || !po) return null;

  // 1. Phân loại các nhà cung cấp có trong đơn hàng PO
  const suppliersInPO = useMemo(() => {
    if (!po || !po.items) return [];
    const map = new Map();
    po.items.forEach(item => {
      const rawSup = item.supplier || item.supplier_name || 'FTI';
      const info = getSupplierInfo(rawSup);
      if (!map.has(info.code)) {
        map.set(info.code, {
          ...info,
          items: []
        });
      }
      map.get(info.code).items.push(item);
    });
    const list = Array.from(map.values());
    return list.length > 0 ? list : [getSupplierInfo('FTI')];
  }, [po]);

  // Nhà cung cấp đang được chọn
  const [selectedSupplierCode, setSelectedSupplierCode] = useState(() => suppliersInPO[0]?.code || 'FTI');

  const activeSupplier = useMemo(() => {
    return suppliersInPO.find(s => s.code === selectedSupplierCode) || suppliersInPO[0] || getSupplierInfo('FTI');
  }, [suppliersInPO, selectedSupplierCode]);

  // Email người nhận (có thể sửa đổi)
  const [recipientEmail, setRecipientEmail] = useState('');
  useEffect(() => {
    if (activeSupplier) {
      setRecipientEmail(activeSupplier.email || 'sales@supplier.com');
    }
  }, [activeSupplier]);

  // Trạng thái copy & download & gửi
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Sinh link riêng và nội dung email bắt buộc theo Mục A
  const poNumber = po.po || po.po_number || 'PO';
  const supplierLink = generateSupplierLink(poNumber, activeSupplier.code);
  const { subject, body } = generateOrderEmailTemplate({
    poNumber,
    supplierLink
  });

  // Hàng hóa của NCC đang chọn
  const supplierItems = activeSupplier.items || [];
  const totalAmount = supplierItems.reduce((s, it) => s + (Number(it.amount) || (Number(it.qty || 1) * Number(it.price || 0))), 0);
  const totalQty = supplierItems.reduce((s, it) => s + (Number(it.qty) || 1), 0);

  // 1. Thao tác Sao chép Email
  const handleCopyEmail = async () => {
    const fullText = `Tiêu đề: ${subject}\n\n${body}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      alert('Không thể tự động sao chép. Vui lòng bôi đen và nhấn Ctrl+C.');
    }
  };

  // 2. Thao tác Tải file Excel Đặt hàng (Đúng 9 cột theo Mục B)
  const handleDownloadExcel = async () => {
    setIsDownloading(true);
    try {
      await excelExporter.exportSupplierOrderExcel({
        poData: po,
        supplierCode: activeSupplier.code,
        supplierName: activeSupplier.name,
        items: supplierItems
      });
    } catch (err) {
      console.error('Lỗi xuất file PO riêng NCC:', err);
      alert(`Lỗi xuất file Excel: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // 3. Mở Gmail Web
  const handleOpenGmail = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };

  // 4. Mở Outlook / Ứng dụng Mail mặc định
  const handleOpenOutlook = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  // Mở Outlook Web (Office 365)
  const handleOpenOutlookWeb = () => {
    const outlookWebUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(recipientEmail)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(outlookWebUrl, '_blank');
  };

  // 5. Xác nhận đã gửi email và chuyển trạng thái PO
  const handleConfirmSent = async () => {
    if (!window.confirm(`Xác nhận đã gửi Email đặt hàng cho Nhà cung cấp "${activeSupplier.name}" (${recipientEmail})?`)) {
      return;
    }
    setIsConfirming(true);
    try {
      if (onConfirmSent) {
        await onConfirmSent({
          poId: po.id,
          poNumber,
          supplierCode: activeSupplier.code,
          supplierName: activeSupplier.name,
          recipientEmail,
          itemsCount: supplierItems.length,
          totalQty,
          totalAmount
        });
      }
      setSendSuccess(true);
      setTimeout(() => {
        setSendSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      alert(`Lỗi ghi nhận: ${err.message}`);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1050 }}>
      <div
        className="modal-dialog modal-large"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', width: '92%' }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ borderBottom: '2px solid #e2e8f0' }}>
          <div className="modal-title-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: '#003366',
              color: '#fff',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex'
            }}>
              <Mail size={20} />
            </div>
            <div>
              <h3 className="modal-title" style={{ color: '#003366', margin: 0 }}>
                Soạn & Gửi Email Đặt Hàng – PO: {poNumber}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                Hệ thống Nam A Bank tự động tạo nội dung và đính kèm đơn đặt hàng riêng cho NCC
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '20px 24px', maxHeight: '78vh', overflowY: 'auto' }}>
          {/* Thông báo thành công nếu vừa xác nhận */}
          {sendSuccess && (
            <div style={{
              padding: '12px 16px',
              background: '#dcfce7',
              border: '1px solid #86efac',
              borderRadius: '6px',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px',
              fontWeight: 600
            }}>
              <CheckCircle2 size={20} />
              Đã ghi nhận gửi email đặt hàng thành công! Trạng thái PO đã chuyển sang "Đã đặt hàng".
            </div>
          )}

          {/* 1. Chọn Nhà cung cấp (nếu PO có nhiều NCC) */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
              Nhà cung cấp trong đơn hàng PO ({suppliersInPO.length} NCC):
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {suppliersInPO.map(sup => (
                <button
                  key={sup.code}
                  type="button"
                  onClick={() => setSelectedSupplierCode(sup.code)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: selectedSupplierCode === sup.code ? '2px solid #003366' : '1px solid #cbd5e1',
                    background: selectedSupplierCode === sup.code ? '#eff6ff' : '#ffffff',
                    color: selectedSupplierCode === sup.code ? '#003366' : '#334155',
                    fontWeight: selectedSupplierCode === sup.code ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s'
                  }}
                >
                  <Building size={14} />
                  <span>{sup.name}</span>
                  <span style={{
                    fontSize: '11px',
                    background: selectedSupplierCode === sup.code ? '#003366' : '#e2e8f0',
                    color: selectedSupplierCode === sup.code ? '#ffffff' : '#475569',
                    padding: '2px 6px',
                    borderRadius: '10px'
                  }}>
                    {sup.items.length} mặt hàng
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Địa chỉ Email người nhận */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                Email người nhận (Nhà cung cấp):
              </label>
              <input
                type="email"
                className="form-input"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="email@supplier.com"
                style={{ width: '100%', padding: '9px 12px', fontSize: '13.5px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Lấy từ danh bạ NCC Nam A Bank. Admin có thể sửa trực tiếp nếu có email mới.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                File Excel đơn đặt hàng riêng (Tự động theo Mục B):
              </label>
              <div style={{
                padding: '9px 12px',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#003366' }}>
                  PO_NAMABANK_{poNumber}_{activeSupplier.code}.xlsx
                </span>
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  disabled={isDownloading}
                  style={{
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '5px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Tải file Excel đặt hàng 9 cột chuẩn"
                >
                  <Download size={13} />
                  {isDownloading ? 'Đang tạo...' : 'Tải file'}
                </button>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Gồm đúng 9 cột, lọc đúng {supplierItems.length} dòng hàng của {activeSupplier.code}.
              </span>
            </div>
          </div>

          {/* 3. Đường link xác nhận riêng cho NCC (Mục A & Mục D) */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
              Link xác nhận đặt hàng riêng theo PO & NCC (Dẫn vào Supplier Portal):
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                readOnly
                value={supplierLink}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '12.5px',
                  color: '#003366'
                }}
              />
              <button
                type="button"
                onClick={() => window.open(supplierLink, '_blank')}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  color: '#334155'
                }}
                title="Mở thử link NCC"
              >
                <ExternalLink size={14} />
                Thử truy cập
              </button>
            </div>
          </div>

          {/* 4. Nội dung Email chuẩn BẮT BUỘC (Mục A) */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                Nội dung Email gửi NCC (Chuẩn mẫu Ngân Hàng Nam A Bank):
              </label>
              <button
                type="button"
                onClick={handleCopyEmail}
                style={{
                  background: copied ? '#10b981' : '#f1f5f9',
                  color: copied ? '#ffffff' : '#1e293b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s'
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Đã sao chép!' : 'Sao chép nội dung'}
              </button>
            </div>

            <div style={{
              background: '#fafafa',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '14px 16px',
              fontSize: '13px',
              lineHeight: '1.6',
              color: '#1e293b'
            }}>
              <div style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 600, color: '#64748b' }}>Tiêu đề: </span>
                <span style={{ fontWeight: 700, color: '#003366' }}>{subject}</span>
              </div>
              <pre style={{
                margin: 0,
                fontFamily: 'inherit',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '13px',
                color: '#334155'
              }}>
                {body}
              </pre>
            </div>
          </div>

          {/* 5. CẢNH BÁO BẮT BUỘC THEO MỤC C (ĐIỂM 8) */}
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            borderLeft: '4px solid #f59e0b',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '13px', color: '#92400e', lineHeight: '1.5' }}>
              <strong>Lưu ý quan trọng:</strong> Trình duyệt web không thể tự động đính kèm file do chính sách bảo mật hệ điều hành. Vui lòng bấm <strong>TẢI FILE ĐẶT HÀNG</strong> để lưu file Excel về máy và đính kèm (Attach file) vào email trước khi nhấn Gửi.
            </div>
          </div>

          {/* 6. THANH NÚT THAO TÁC THEO MỤC C (NÚT 1, 2, 3, 4, 9) */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '16px',
            borderTop: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* Nút 1: SAO CHÉP EMAIL */}
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCopyEmail}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px' }}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'ĐÃ SAO CHÉP EMAIL' : 'SAO CHÉP EMAIL'}
              </button>

              {/* Nút 2: TẢI FILE ĐẶT HÀNG */}
              <button
                type="button"
                className="btn-secondary"
                onClick={handleDownloadExcel}
                disabled={isDownloading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  background: '#0284c7',
                  color: '#fff',
                  borderColor: '#0284c7'
                }}
              >
                <FileSpreadsheet size={15} />
                {isDownloading ? 'ĐANG TẢI...' : 'TẢI FILE ĐẶT HÀNG'}
              </button>

              {/* Nút 3: MỞ GMAIL */}
              <button
                type="button"
                className="btn-secondary"
                onClick={handleOpenGmail}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  background: '#ea4335',
                  color: '#fff',
                  borderColor: '#ea4335'
                }}
              >
                <Mail size={15} />
                MỞ GMAIL
              </button>

              {/* Nút 4: MỞ OUTLOOK / MAIL */}
              <button
                type="button"
                className="btn-secondary"
                onClick={handleOpenOutlook}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  background: '#0078d4',
                  color: '#fff',
                  borderColor: '#0078d4'
                }}
                title="Mở ứng dụng Mail / Outlook mặc định qua mailto"
              >
                <Send size={15} />
                MỞ OUTLOOK
              </button>

              {/* Mở Outlook Web */}
              <button
                type="button"
                className="btn-secondary"
                onClick={handleOpenOutlookWeb}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '9px 10px',
                  fontSize: '12px'
                }}
                title="Mở Outlook Trình Duyệt Web (Office 365)"
              >
                <ExternalLink size={13} />
                Web Outlook
              </button>
            </div>

            {/* Nút 9: XÁC NHẬN ĐÃ GỬI */}
            <button
              type="button"
              className="btn-primary"
              onClick={handleConfirmSent}
              disabled={isConfirming}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: '#16a34a',
                borderColor: '#16a34a',
                fontWeight: 700
              }}
            >
              <CheckCircle2 size={16} />
              {isConfirming ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN ĐÃ GỬI'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderEmailModal;
