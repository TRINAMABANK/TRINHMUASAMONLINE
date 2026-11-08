import React, { useState } from 'react';
import { formatCurrency } from '../utils/currencyUtils.js';
import {
  Landmark,
  Building2,
  CheckCircle2,
  CheckCheck,
  XSquare,
  RotateCcw
} from 'lucide-react';

/**
 * Thanh công cụ cố định thao tác hàng loạt (khớp 100% hình ảnh yêu cầu)
 * Logic bù trừ:
 * Phần tick chọn Hội sở thanh toán -> phần còn lại tự động là Đơn vị thanh toán và ngược lại
 */
export function BatchActionToolbar({
  selectedCount = 0,
  selectedTotalAmount = 0,
  totalCount = 0,
  totalAmount = 0,
  classifiedCount = 0,
  onAcceptClassification,
  onSelectAll,
  onDeselectAll,
  onUnclassifyAll
}) {
  // Loại thanh toán áp dụng cho PHẦN ĐƯỢC TICK: '' | 'HOI_SO' | 'DON_VI'
  const [paymentType, setPaymentType] = useState('DON_VI'); // Mặc định như trong ảnh người dùng (Đơn vị thanh toán active màu cam)

  // Số lượng và tiền của phần còn lại (không tick)
  const unselectedCount = Math.max(0, totalCount - selectedCount);
  const unselectedTotalAmount = Math.max(0, totalAmount - selectedTotalAmount);

  // Nhóm đối ứng
  const otherType = paymentType === 'HOI_SO' ? 'DON_VI' : 'HOI_SO';
  const targetLabel = paymentType === 'HOI_SO' ? 'Hội sở thanh toán' : 'Đơn vị thanh toán';
  const otherLabel = otherType === 'HOI_SO' ? 'Hội sở thanh toán' : 'Đơn vị thanh toán';

  // Xử lý khi nhấn nút ACCEPT – XÁC NHẬN PHÂN LOẠI
  const handleAcceptClick = () => {
    if (selectedCount === 0) {
      alert('Vui lòng tick chọn ít nhất một dòng hàng hóa trước khi nhấn ACCEPT.');
      return;
    }

    if (!paymentType) {
      alert('Vui lòng chọn loại thanh toán (Hội sở thanh toán hoặc Đơn vị thanh toán) trước khi nhấn ACCEPT.');
      return;
    }

    const confirmMessage =
      `XÁC NHẬN PHÂN LOẠI TOÀN BỘ HỒ SƠ:\n\n` +
      `• Phần tick chọn (${selectedCount} dòng - ${formatCurrency(selectedTotalAmount)}): ${targetLabel.toUpperCase()}\n` +
      (unselectedCount > 0
        ? `• Phần còn lại (${unselectedCount} dòng - ${formatCurrency(unselectedTotalAmount)}): ${otherLabel.toUpperCase()}\n\n`
        : '\n') +
      `Bạn có chắc chắn muốn xác nhận phân loại?`;

    const isConfirmed = window.confirm(confirmMessage);
    if (!isConfirmed) {
      return;
    }

    // Gọi callback phân loại bù trừ
    const result = onAcceptClassification(paymentType);
    if (result !== false) {
      alert(
        `ĐÃ PHÂN LOẠI THÀNH CÔNG TOÀN BỘ HỒ SƠ!\n\n` +
        `• ${targetLabel}: ${selectedCount} dòng (${formatCurrency(selectedTotalAmount)})\n` +
        (unselectedCount > 0
          ? `• ${otherLabel}: ${unselectedCount} dòng (${formatCurrency(unselectedTotalAmount)})\n`
          : '')
      );
    }
  };

  const handleUnclassifyClick = () => {
    if (classifiedCount === 0) {
      alert('Hiện chưa có dòng nào được phân loại.');
      return;
    }
    const ok = window.confirm(
      `XÁC NHẬN HỦY PHÂN LOẠI:\n` +
      `Bạn có chắc chắn muốn hủy phân loại cho toàn bộ ${classifiedCount} dòng đã gán không?\n` +
      `Các dòng sẽ quay về trạng thái ban đầu.`
    );
    if (ok) {
      onUnclassifyAll();
    }
  };

  return (
    <div className="batch-toolbar-sticky">
      <div className="batch-toolbar-panel">
        {/* HÀNG TRÊN: Thống kê + Lựa chọn loại thanh toán + Nút ACCEPT */}
        <div className="toolbar-top-row">
          {/* 1. Thống kê số dòng và tiền đã chọn */}
          <div className="toolbar-stats-segment">
            <span className="stat-text">
              Đã chọn: <strong className="stat-count-highlight">{selectedCount} / {totalCount} dòng</strong>
            </span>
            <span className="stat-pipe">|</span>
            <span className="stat-text">
              Tổng tiền: <strong className="stat-amount-highlight">{formatCurrency(selectedTotalAmount)}</strong>
            </span>
          </div>

          {/* 2. Chọn loại thanh toán cho phần tick */}
          <div className="toolbar-payment-choice-segment">
            <span className="choice-label">Chọn loại thanh toán:</span>

            <button
              type="button"
              className={`btn-choice-toggle btn-toggle-ho ${paymentType === 'HOI_SO' ? 'active-ho' : ''}`}
              onClick={() => setPaymentType('HOI_SO')}
              title="Phần tick chọn là Hội sở thanh toán, phần còn lại là Đơn vị thanh toán"
            >
              <Landmark size={16} />
              <span>Hội sở thanh toán</span>
            </button>

            <button
              type="button"
              className={`btn-choice-toggle btn-toggle-dv ${paymentType === 'DON_VI' ? 'active-dv' : ''}`}
              onClick={() => setPaymentType('DON_VI')}
              title="Phần tick chọn là Đơn vị thanh toán, phần còn lại là Hội sở thanh toán"
            >
              <Building2 size={16} />
              <span>Đơn vị thanh toán</span>
            </button>
          </div>

          {/* 3. Nút ACCEPT – XÁC NHẬN PHÂN LOẠI */}
          <div className="toolbar-accept-segment">
            <button
              type="button"
              className="btn-accept-main"
              onClick={handleAcceptClick}
              title="Xác nhận phân loại bù trừ cho toàn bộ hồ sơ"
            >
              <CheckCircle2 size={18} />
              <span>ACCEPT – XÁC NHẬN PHÂN LOẠI</span>
            </button>
          </div>
        </div>

        {/* HÀNG DƯỚI: Các nút tiện ích (Chọn tất cả, Bỏ chọn, Bỏ phân loại) + Ghi chú phân bổ */}
        <div className="toolbar-bottom-row">
          <div className="toolbar-quick-buttons">
            <button
              type="button"
              className="btn-quick-sub"
              onClick={onSelectAll}
              title="Tick chọn tất cả các dòng trong bảng"
            >
              <CheckCheck size={14} />
              <span>Chọn tất cả</span>
            </button>

            <button
              type="button"
              className="btn-quick-sub"
              onClick={onDeselectAll}
              title="Bỏ tick toàn bộ các dòng"
            >
              <XSquare size={14} />
              <span>Bỏ chọn ({selectedCount})</span>
            </button>

            {classifiedCount > 0 && (
              <button
                type="button"
                className="btn-quick-sub btn-quick-reset"
                onClick={handleUnclassifyClick}
                title="Hủy toàn bộ phân loại của hồ sơ"
              >
                <RotateCcw size={14} />
                <span>Bỏ phân loại ({classifiedCount})</span>
              </button>
            )}
          </div>

          {/* Gợi ý phân bổ bù trừ trực quan */}
          {selectedCount > 0 && (
            <div className="toolbar-distribution-hint">
              Phần tick (<b>{selectedCount}</b> dòng): <span className={paymentType === 'HOI_SO' ? 'text-ho' : 'text-dv'}>{targetLabel}</span>
              {unselectedCount > 0 && (
                <>
                  {' • '}Phần còn lại (<b>{unselectedCount}</b> dòng): <span className={otherType === 'HOI_SO' ? 'text-ho' : 'text-dv'}>{otherLabel}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
