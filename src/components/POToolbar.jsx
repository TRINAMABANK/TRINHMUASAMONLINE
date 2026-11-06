import React from 'react';
import { PAY_GROUPS } from '../utils/constants.js';
import { PlusCircle, RotateCcw, FileDown, CheckCircle, ShieldAlert } from 'lucide-react';

export function POToolbar({
  poNumber,
  onPoChange,
  date,
  onDateChange,
  requester,
  onRequesterChange,
  payGroup,
  onPayGroupChange,
  note,
  onNoteChange,
  selectedCount,
  canUndo,
  onUndo,
  onAddRow,
  onCreatePO,
  isExporting
}) {
  return (
    <div className="po-toolbar-card">
      <div className="po-toolbar-header">
        <h3 className="toolbar-title">Thiết lập Hồ sơ PO & Xuất 2 Mẫu Excel</h3>
        <div className="toolbar-controls">
          <button
            type="button"
            className="btn-toolbar-sec"
            onClick={onUndo}
            disabled={!canUndo}
            title="Khôi phục lại thay đổi trước đó"
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
          <label className="form-label">Nhóm thanh toán Bảng kê</label>
          <select
            className="form-select"
            value={payGroup}
            onChange={(e) => onPayGroupChange(e.target.value)}
          >
            {PAY_GROUPS.map((pg) => (
              <option key={pg.id} value={pg.id}>
                {pg.name}
              </option>
            ))}
          </select>
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

      <div className="po-toolbar-footer">
        {selectedCount === 0 ? (
          <div className="toolbar-notice text-warning">
            <ShieldAlert size={18} />
            <span>Vui lòng tick chọn ít nhất 1 dòng trong bảng bên dưới để tạo PO và xuất 2 file Excel.</span>
          </div>
        ) : (
          <div className="toolbar-notice text-success">
            <CheckCircle size={18} />
            <span>Sẵn sàng xuất 2 file: <b>1. BẢNG TRÌNH KÝ</b> & <b>2. BẢNG KÊ</b> cho <b>{selectedCount}</b> dòng đã chọn.</span>
          </div>
        )}

        <button
          type="button"
          className="btn-create-po"
          disabled={selectedCount === 0 || isExporting}
          onClick={onCreatePO}
        >
          <FileDown size={18} />
          {isExporting ? 'Đang tạo & xuất Excel...' : `Tạo PO & Xuất 2 File Excel (${selectedCount} dòng)`}
        </button>
      </div>
    </div>
  );
}
