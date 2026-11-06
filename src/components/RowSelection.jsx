import React from 'react';
import { formatCurrency } from '../utils/currencyUtils.js';
import { CheckCheck, XSquare, Building2, Landmark } from 'lucide-react';

export function RowSelection({
  selectedCount,
  totalCount,
  totalAmount,
  totalQty,
  countA = 0,
  amountA = 0,
  countB = 0,
  amountB = 0,
  onSelectAll,
  onDeselectAll
}) {
  return (
    <div className="selection-toolbar">
      <div className="selection-info">
        <span className="selection-badge">
          Đang chọn <b>{selectedCount}</b> / {totalCount} dòng
        </span>
        <span className="selection-divider">•</span>
        <span className="selection-metric">
          Tổng SL: <b>{totalQty}</b>
        </span>
        <span className="selection-divider">•</span>
        <span className="selection-metric text-highlight">
          Tổng chưa VAT: <b>{formatCurrency(totalAmount)}</b>
        </span>

        {/* Phân bổ nhóm thanh toán */}
        <div className="selection-groups-preview">
          <span className="group-tag tag-ho" title="Nhóm A: Hội sở thanh toán">
            <Landmark size={13} />
            Hội sở: <b>{countA}</b> dòng ({formatCurrency(amountA)})
          </span>
          <span className="group-tag tag-dv" title="Nhóm B: Đơn vị thanh toán">
            <Building2 size={13} />
            Đơn vị: <b>{countB}</b> dòng ({formatCurrency(amountB)})
          </span>
        </div>
      </div>

      <div className="selection-actions">
        <button
          type="button"
          className="btn-select-action"
          onClick={onSelectAll}
          title="Chọn toàn bộ các dòng trong bảng"
        >
          <CheckCheck size={16} />
          Chọn tất cả
        </button>
        <button
          type="button"
          className="btn-select-action"
          onClick={onDeselectAll}
          title="Bỏ chọn toàn bộ"
        >
          <XSquare size={16} />
          Bỏ chọn
        </button>
      </div>
    </div>
  );
}
