import React, { useState, useEffect, useCallback } from 'react';
import { supplierInvitationApi } from '../services/api/supplierPortalApi.js';
import { excelExporter } from '../services/excelExporter.js';
import {
  Mail,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Ban,
  Check,
  Download,
  Building2,
  Clock,
  Truck,
  Send,
  Eye,
  Calendar,
  FileCheck
} from 'lucide-react';

export function SupplierOrderManagementSection({ po, onPoUpdated }) {
  const [loading, setLoading] = useState(false);
  const [managementData, setManagementData] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [emailInputs, setEmailInputs] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeDrafts, setActiveDrafts] = useState({});

  // 1. Nạp danh sách quản lý gửi đơn của từng NCC trong PO
  const loadData = useCallback(async () => {
    if (!po?.id) return;
    setLoading(true);
    try {
      const res = await supplierInvitationApi.getPoSupplierManagement(po.id);
      if (res.success && res.data) {
        setManagementData(res.data);
        // Cập nhật email input mặc định
        const initialEmails = {};
        (res.data.suppliers || []).forEach(s => {
          const email = s.invitation?.recipient_email || s.supplierEmail || (s.supplierCode === 'FTI' ? 'sales@fti.vn' : `${s.supplierCode.toLowerCase()}@supplier.com`);
          initialEmails[s.supplierId || s.supplierCode] = email;
        });
        setEmailInputs(initialEmails);

        if (!selectedSupplierId && res.data.suppliers?.length > 0) {
          setSelectedSupplierId(res.data.suppliers[0].supplierId || res.data.suppliers[0].supplierCode);
        }
      }
    } catch (err) {
      console.warn('Lỗi tải dữ liệu quản lý gửi đơn NCC:', err.message);
    } finally {
      setLoading(false);
    }
  }, [po?.id, selectedSupplierId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Copy to clipboard helper
  const copyToClipboard = async (text, key) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch (e) {
      alert('Không thể sao chép tự động. Vui lòng thử lại.');
    }
  };

  // 1. Tạo Email Đặt Hàng & Sinh Token Bảo Mật
  const handleGenerateInvitation = async (sup) => {
    const sKey = sup.supplierId || sup.supplierCode;
    const email = emailInputs[sKey] || sup.supplierEmail || 'sales@supplier.com';
    setActionLoading(prev => ({ ...prev, [sKey]: true }));
    try {
      const res = await supplierInvitationApi.generateInvitation({
        poId: po.id,
        supplierId: sup.supplierId,
        recipientEmail: email,
        baseUrl: window.location.origin
      });

      if (res.success && res.data) {
        setActiveDrafts(prev => ({
          ...prev,
          [sKey]: res.data
        }));
        await loadData();
        if (onPoUpdated) onPoUpdated();
      }
    } catch (err) {
      alert(`Lỗi tạo email: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [sKey]: false }));
    }
  };

  // 2. ADMIN Xác nhận đã gửi email thành công bằng ứng dụng ngoài
  const handleConfirmSent = async (invitationId, sup) => {
    if (!window.confirm(`Xác nhận Bạn đã gửi email đặt hàng thành công cho nhà cung cấp "${sup.supplierName}"?`)) {
      return;
    }
    const sKey = sup.supplierId || sup.supplierCode;
    setActionLoading(prev => ({ ...prev, [sKey]: true }));
    try {
      await supplierInvitationApi.confirmSent(invitationId);
      await loadData();
      if (onPoUpdated) onPoUpdated();
    } catch (err) {
      alert(`Lỗi xác nhận: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [sKey]: false }));
    }
  };

  // 3. Gửi lại Link
  const handleResend = async (invitationId, sup) => {
    const sKey = sup.supplierId || sup.supplierCode;
    setActionLoading(prev => ({ ...prev, [sKey]: true }));
    try {
      const res = await supplierInvitationApi.resend(invitationId);
      if (res.success && res.data) {
        setActiveDrafts(prev => ({
          ...prev,
          [sKey]: res.data
        }));
        await loadData();
        if (onPoUpdated) onPoUpdated();
      }
    } catch (err) {
      alert(`Lỗi gửi lại link: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [sKey]: false }));
    }
  };

  // 4. Thu hồi Link
  const handleRevoke = async (invitationId, sup) => {
    if (!window.confirm(`Bạn có chắc chắn muốn THU HỒI liên kết đối tác của "${sup.supplierName}"? Đối tác sẽ không thể truy cập link này nữa.`)) {
      return;
    }
    const sKey = sup.supplierId || sup.supplierCode;
    setActionLoading(prev => ({ ...prev, [sKey]: true }));
    try {
      await supplierInvitationApi.revoke(invitationId);
      await loadData();
      if (onPoUpdated) onPoUpdated();
    } catch (err) {
      alert(`Lỗi thu hồi link: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [sKey]: false }));
    }
  };

  // 5. Tải file Excel Đặt hàng riêng (9 Cột chuẩn Mục B)
  const handleDownloadExcel = async (sup) => {
    try {
      const supItems = (po.items || []).filter(item => {
        const sName = item.supplier || item.supplier_name || '';
        return sName.toLowerCase().includes(sup.supplierName.toLowerCase()) ||
               sName.toLowerCase().includes(sup.supplierCode.toLowerCase());
      });
      await excelExporter.exportSupplierOrderExcel({
        poData: po,
        supplierCode: sup.supplierCode,
        supplierName: sup.supplierName,
        items: supItems.length > 0 ? supItems : (po.items || [])
      });
    } catch (err) {
      alert(`Lỗi xuất Excel: ${err.message}`);
    }
  };

  // Mở Gmail
  const openGmail = (recipient, subject, body) => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };

  // Mở Outlook / Mail client
  const openOutlook = (recipient, subject, body) => {
    const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  const suppliers = managementData?.suppliers || [];

  return (
    <div className="supplier-order-management-section" style={{
      marginTop: '24px',
      background: '#ffffff',
      border: '1px solid #cbd5e1',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
    }}>
      {/* Header khu vực */}
      <div style={{
        padding: '14px 18px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: '#003366',
            color: '#fff',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex'
          }}>
            <Mail size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              QUẢN LÝ GỬI ĐƠN ĐẶT HÀNG (THEO TỪNG NHÀ CUNG CẤP)
            </h4>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Tạo link riêng bảo mật • Soạn nội dung gửi Gmail & Outlook • Theo dõi tiến độ giao hàng
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            color: '#475569'
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Làm mới tiến độ
        </button>
      </div>

      {/* Bảng danh sách nhà cung cấp trong PO */}
      <div style={{ overflowX: 'auto', padding: '12px 18px' }}>
        {suppliers.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
            {loading ? 'Đang nạp dữ liệu nhà cung cấp...' : 'Chưa tìm thấy dữ liệu nhà cung cấp trong PO này.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {suppliers.map((sup, idx) => {
              const sKey = sup.supplierId || sup.supplierCode;
              const isSelected = selectedSupplierId === sKey;
              const inv = sup.invitation;
              const conf = sup.confirmation;
              const draft = activeDrafts[sKey];
              const isLoadingAction = actionLoading[sKey];

              // Link đối tác: ưu tiên từ draft vừa sinh, hoặc từ token invitation
              const partnerLink = draft?.supplierLink || (inv?.token_hash ? `${window.location.origin}/supplier-portal/${draft?.token || ''}` : '');
              const emailSubject = draft?.subject || `NAM A BANK – ĐƠN ĐẶT HÀNG PO ${po.po || po.po_number || 'PO'}`;
              const emailBody = draft?.body || '';
              const recipientEmail = emailInputs[sKey] || sup.supplierEmail || '';

              // Trạng thái hiển thị badge
              const getWorkflowBadge = (status) => {
                switch (status) {
                  case 'CHUA_TAO_EMAIL':
                    return { label: 'Chưa tạo email', bg: '#f1f5f9', color: '#475569' };
                  case 'DA_TAO_EMAIL':
                    return { label: 'Đã tạo bản nháp', bg: '#eff6ff', color: '#1d4ed8' };
                  case 'ADMIN_DA_GUI':
                    return { label: 'ADMIN xác nhận đã gửi', bg: '#e0e7ff', color: '#4338ca' };
                  case 'NCC_DA_XAC_NHAN':
                  case 'DA_CO_NGAY_GIAO':
                    return { label: 'Đối tác đã xác nhận PO', bg: '#fef3c7', color: '#b45309' };
                  case 'XUAT_KHO_MOT_PHAN':
                    return { label: 'Xuất kho một phần', bg: '#ffedd5', color: '#c2410c' };
                  case 'DA_GIAO_DU':
                    return { label: 'Đã giao đủ', bg: '#dcfce7', color: '#15803d' };
                  case 'REVOKED':
                    return { label: 'Link đã bị thu hồi', bg: '#fee2e2', color: '#b91c1c' };
                  default:
                    return { label: status, bg: '#f1f5f9', color: '#475569' };
                }
              };

              const badge = getWorkflowBadge(sup.workflowStatus);

              return (
                <div
                  key={sKey}
                  style={{
                    border: isSelected ? '2px solid #0056A3' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    background: isSelected ? '#f8fafc' : '#ffffff',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Hàng thông tin chính */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                          {idx + 1}. {sup.supplierName}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>({sup.supplierCode})</span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: badge.bg,
                          color: badge.color
                        }}>
                          {badge.label}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '12px', color: '#475569', flexWrap: 'wrap' }}>
                        <span>Mã PO: <strong>{managementData.poNumber}</strong></span>
                        <span>Số lượng đặt: <strong>{sup.totalQty} sản phẩm</strong> ({sup.itemCount} dòng hàng)</span>
                        {conf?.expected_delivery_date && (
                          <span style={{ color: '#0369a1' }}>
                            <Calendar size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} />
                            Dự kiến giao: <strong>{new Date(conf.expected_delivery_date).toLocaleDateString('vi-VN')}</strong>
                          </span>
                        )}
                        {sup.totalDeliveredQty > 0 && (
                          <span style={{ color: '#15803d' }}>
                            <Truck size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} />
                            Đã giao: <strong>{sup.totalDeliveredQty} / {sup.totalQty}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Nút chọn nhà cung cấp */}
                    <button
                      type="button"
                      onClick={() => setSelectedSupplierId(sKey)}
                      style={{
                        padding: '6px 14px',
                        background: isSelected ? '#0056A3' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#0056A3',
                        border: '1px solid #0056A3',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {isSelected ? '✓ Đang chọn' : 'Chọn Nhà Cung Cấp'}
                    </button>
                  </div>

                  {/* Nhập email nhận đơn */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '14px',
                    background: '#f1f5f9',
                    padding: '8px 12px',
                    borderRadius: '6px'
                  }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', minWidth: '110px' }}>
                      Email nhận đơn:
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setEmailInputs(prev => ({ ...prev, [sKey]: e.target.value }))}
                      placeholder="Nhập email đại diện nhà cung cấp..."
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleGenerateInvitation(sup)}
                      disabled={isLoadingAction}
                      style={{
                        padding: '6px 14px',
                        background: '#0056A3',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Mail size={14} />
                      {isLoadingAction ? 'Đang tạo...' : inv ? 'Tạo Lại Email' : 'Tạo Email Đặt Hàng'}
                    </button>
                  </div>

                  {/* Khu vực thao tác sau khi tạo email */}
                  {(draft || inv) && (
                    <div style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      {/* Tiêu đề & Link */}
                      <div style={{ fontSize: '12px', color: '#1e293b' }}>
                        <div><strong>Tiêu đề:</strong> {emailSubject}</div>
                        {draft?.supplierLink && (
                          <div style={{ marginTop: '4px', wordBreak: 'break-all' }}>
                            <strong>Link riêng đối tác:</strong>{' '}
                            <a href={draft.supplierLink} target="_blank" rel="noreferrer" style={{ color: '#0056A3', textDecoration: 'underline' }}>
                              {draft.supplierLink}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Thanh công cụ 8 nút hành động theo yêu cầu Mục 2 */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
                        {/* 1. Sao chép nội dung email */}
                        <button
                          type="button"
                          onClick={() => copyToClipboard(`Tiêu đề: ${emailSubject}\n\n${emailBody || 'Xem chi tiết đơn hàng tại link đối tác.'}`, `email_${sKey}`)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          {copiedKey === `email_${sKey}` ? <Check size={13} color="green" /> : <Copy size={13} />}
                          {copiedKey === `email_${sKey}` ? 'Đã sao chép' : 'Sao chép nội dung Email'}
                        </button>

                        {/* 2. Mở Gmail */}
                        <button
                          type="button"
                          onClick={() => openGmail(recipientEmail, emailSubject, emailBody)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <ExternalLink size={13} />
                          Mở Gmail
                        </button>

                        {/* 3. Mở Outlook / Mail */}
                        <button
                          type="button"
                          onClick={() => openOutlook(recipientEmail, emailSubject, emailBody)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <Mail size={13} />
                          Mở Outlook / Mail
                        </button>

                        {/* 4. Sao chép link đối tác */}
                        {draft?.supplierLink && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(draft.supplierLink, `link_${sKey}`)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 10px',
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            {copiedKey === `link_${sKey}` ? <Check size={13} color="green" /> : <Copy size={13} />}
                            {copiedKey === `link_${sKey}` ? 'Đã sao chép link' : 'Sao chép link đối tác'}
                          </button>
                        )}

                        {/* 5. Gửi lại link */}
                        {inv && !inv.revoked_at && (
                          <button
                            type="button"
                            onClick={() => handleResend(inv.id, sup)}
                            disabled={isLoadingAction}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 10px',
                              background: '#fffbeb',
                              color: '#b45309',
                              border: '1px solid #fde68a',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            <RefreshCw size={13} />
                            Gửi lại link
                          </button>
                        )}

                        {/* 6. Thu hồi link */}
                        {inv && !inv.revoked_at && (
                          <button
                            type="button"
                            onClick={() => handleRevoke(inv.id, sup)}
                            disabled={isLoadingAction}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 10px',
                              background: '#fff1f2',
                              color: '#be123c',
                              border: '1px solid #fecdd3',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            <Ban size={13} />
                            Thu hồi link
                          </button>
                        )}

                        {/* 7. Xuất file Excel Đặt hàng riêng (9 cột) */}
                        <button
                          type="button"
                          onClick={() => handleDownloadExcel(sup)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            background: '#f0fdf4',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <Download size={13} />
                          Tải File Đặt Hàng (9 Cột)
                        </button>

                        {/* 8. ADMIN Xác nhận đã gửi email */}
                        {inv && (inv.status === 'EMAIL_DRAFT_CREATED' || inv.status === 'EMAIL_RESENT') && (
                          <button
                            type="button"
                            onClick={() => handleConfirmSent(inv.id, sup)}
                            disabled={isLoadingAction}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              background: '#15803d',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              marginLeft: 'auto'
                            }}
                          >
                            <CheckCircle2 size={14} />
                            Xác Nhận Đã Gửi Email
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SupplierOrderManagementSection;
