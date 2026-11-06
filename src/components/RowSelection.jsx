import React from 'react';
import { formatCurrency } from '../utils/currencyUtils.js';
import { CheckSquare, Square, CheckCheck, XSquare } from 'lucide-react';

export function RowSelection({
  selectedCount,
  totalCount,
  totalAmount,
  totalQty,
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
