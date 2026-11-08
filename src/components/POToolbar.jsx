import React from 'react';
import { formatCurrency } from '../utils/currencyUtils.js';
import {
  PlusCircle,
  RotateCcw,
  Landmark,
  Building2
} from 'lucide-react';

export function POToolbar({
  poNumber,
  onPoChange,
  date,
  onDateChange,
  requester,
  onRequesterChange,
  note,
  onNoteChange,
  countHO = 0,
  amountHO = 0,
  countDV = 0,
  amountDV = 0,
  canUndo,
  onUndo,
  onAddRow
}) {
  return (
    <div className="po-toolbar-card">
      <div className="po-toolbar-header">
        <div>
          <h3 className="toolbar-title">Thiết lập Thông tin Hồ sơ PO</h3>
          <p className="toolbar-desc">
            Nhập số hiệu PO, ngày lập, người đề xuất và trích yếu hồ sơ mua sắm
          </p>
        </div>
        <div className="toolbar-controls">
          <button
            type="button"
            className="btn-toolbar-sec"
            onClick={onUndo}
            disabled={!canUndo}
            title="Khôi phục lại thay đổi trước đó (Undo)"
          >
            <RotateCcw size={16} />
            Hoàn tác (Undo)
          </button>
          <button
            type="button"
            className="btn-toolbar-sec"
            onClick={onAddRow}
            title="Thêm một dòng dữ liệu mới vào bảng"
          >
            <PlusCircle size={16} />
            Thêm dòng
          </button>
        </div>
      </div>

      <div className="po-form-grid">
        <div className="form-group">
          <label className="form-label">
            Mã PO (Tự động tăng) <span className="req">*</span>
          </label>
          <input
            type="text"
            className="form-input font-mono font-bold"
            value={poNumber}
            onChange={(e) => onPoChange(e.target.value)}
            placeholder="PO-2026-00001"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Ngày lập hồ sơ <span className="req">*</span>
          </label>
          <input
            type="date"
            className="form-input"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Người đề xuất / Lập phiếu</label>
          <input
            type="text"
            className="form-input"
            value={requester}
            onChange={(e) => onRequesterChange(e.target.value)}
            placeholder="Nguyễn Văn A"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Tóm tắt cấu trúc hồ sơ</label>
          <div className="po-summary-pill-group">
            <span className="po-summary-pill pill-ho" title="Nhóm Hội sở thanh toán">
              <Landmark size={13} />
              <b>{countHO}</b> dòng ({formatCurrency(amountHO)})
            </span>
            <span className="po-summary-pill pill-dv" title="Nhóm Đơn vị thanh toán">
              <Building2 size={13} />
              <b>{countDV}</b> dòng ({formatCurrency(amountDV)})
            </span>
          </div>
        </div>

        <div className="form-group full-width">
          <label className="form-label">Trích yếu / Ghi chú hồ sơ</label>
          <input
            type="text"
            className="form-input"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Ví dụ: Trang bị tài sản định kỳ cho các chi nhánh quý 4/2026..."
          />
        </div>
      </div>
    </div>
  );
}
