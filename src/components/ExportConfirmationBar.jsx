import React from 'react';
import { formatCurrency } from '../utils/currencyUtils.js';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Landmark,
  Building2,
  FileCheck,
  AlertOctagon
} from 'lucide-react';

/**
 * Thanh / Khu vực xác nhận xuất Excel đặt tại CUỐI CÙNG của trang ImportPage
 * 
 * Điều kiện sẵn sàng:
 * - Tất cả dòng hàng hóa hợp lệ đã được phân loại Nhóm TT (HOI_SO hoặc DON_VI)
 * - Không còn dòng nào chưa phân loại (countUnassigned === 0)
 * - Không có lỗi dữ liệu nghiêm trọng
 * - Tổng tiền hai nhóm khớp tổng tiền toàn bộ danh sách
 */
export function ExportConfirmationBar({
  rows = [],
  classifiedCount = 0,
  countHO = 0,
  amountHO = 0,
  countDV = 0,
  amountDV = 0,
  countUnassigned = 0,
  amountUnassigned = 0,
  totalClassifiedAmount = 0,
  grandTotalAmount = 0,
  isExporting = false,
  onExport
}) {
  const totalCount = rows.length;

  // Kiểm tra lỗi dữ liệu nghiêm trọng (tên hàng trống, số lượng <= 0, đơn giá < 0, tiền < 0)
  const hasCriticalErrors = rows.some(r => {
    const itemEmpty = !r.item || String(r.item).trim() === '';
    const qtyInvalid = isNaN(Number(r.qty)) || Number(r.qty) <= 0;
    const priceInvalid = isNaN(Number(r.price)) || Number(r.price) < 0;
    const amountInvalid = isNaN(Number(r.amount)) || Number(r.amount) < 0;
    return itemEmpty || qtyInvalid || priceInvalid || amountInvalid;
  });

  // Kiểm tra khớp tổng tiền
  const amountMatches = Math.abs(totalClassifiedAmount - grandTotalAmount) < 0.01;

  // ĐIỀU KIỆN SẴN SÀNG DUY NHẤT:
  // 1. Có dữ liệu (> 0 dòng)
  // 2. Không còn dòng nào chưa phân loại
  // 3. Toàn bộ các dòng đã được phân loại vào Hội sở hoặc Đơn vị
  // 4. Không có lỗi dữ liệu nghiêm trọng
  // 5. Tổng tiền hai nhóm khớp tổng tiền danh sách
  const isReady =
    totalCount > 0 &&
    countUnassigned === 0 &&
    classifiedCount === totalCount &&
    !hasCriticalErrors &&
    amountMatches;

  return (
    <div className="export-confirmation-wrapper" id="export-confirmation-section">
      <div className={`export-confirmation-card ${isReady ? 'state-ready' : 'state-pending'}`}>
        
        {/* Phần bên trái: Thông báo trạng thái & Hướng dẫn */}
        <div className="confirmation-status-col">
          {isReady ? (
            /* TRẠNG THÁI SẴN SÀNG: MÀU XANH LÁ */
            <div className="status-badge-container ready">
              <div className="status-header-line">
                <span className="status-pill pill-ready">
                  <CheckCircle2 size={16} />
                  SẴN SÀNG XUẤT PHIẾU TRÌNH KÝ
                </span>
                <span className="status-count-tag text-success">
                  {classifiedCount} / {totalCount} dòng đã phân loại (100%)
                </span>
              </div>

              <div className="status-details-text">
                <p className="status-main-msg">
                  Sẵn sàng xuất 01 File Excel gồm đúng 02 Sheet: <b>1. PHIẾU TRÌNH</b> & <b>2. BẢNG KÊ</b>
                </p>
                <div className="status-groups-breakdown">
                  <span className="group-stat-item">
                    <Landmark size={14} className="text-blue" />
                    Hội sở thanh toán: <b>{countHO}</b> dòng ({formatCurrency(amountHO)})
                  </span>
                  <span className="group-stat-sep">•</span>
                  <span className="group-stat-item">
                    <Building2 size={14} className="text-orange" />
                    Đơn vị thanh toán: <b>{countDV}</b> dòng ({formatCurrency(amountDV)})
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* TRẠNG THÁI CHƯA HOÀN TẤT: MÀU VÀNG / CAM */
            <div className="status-badge-container pending">
              <div className="status-header-line">
                <span className="status-pill pill-pending">
                  <Clock size={16} />
                  CHƯA HOÀN TẤT PHÂN LOẠI NHÓM THANH TOÁN
                </span>
                <span className="status-count-tag text-warning">
                  Đã phân loại: {classifiedCount} / {totalCount} dòng
                </span>
              </div>

              <div className="status-details-text">
                <div className="pending-warning-msg">
                  <AlertTriangle size={16} className="text-warning flex-shrink-0" />
                  <span>
                    Hiện còn <b>{countUnassigned}</b> dòng chưa được phân loại ({formatCurrency(amountUnassigned)}).
                  </span>
                </div>
                <p className="pending-instruction">
                  👉 <b>Hướng dẫn:</b> Hãy cuộn lên phía trên, tick chọn các dòng hàng hóa và nhấn nút <b>ACCEPT – XÁC NHẬN PHÂN LOẠI</b> để hoàn tất phân loại 100% dòng trước khi xuất hồ sơ.
                </p>

                {hasCriticalErrors && (
                  <div className="pending-error-msg text-danger">
                    <AlertOctagon size={15} />
                    <span>Có dòng dữ liệu bị lỗi (tên hàng rỗng hoặc số lượng/đơn giá không hợp lệ). Vui lòng kiểm tra lại bảng dữ liệu.</span>
                  </div>
                )}

                {!amountMatches && countUnassigned === 0 && (
                  <div className="pending-error-msg text-danger">
                    <AlertOctagon size={15} />
                    <span>Tổng tiền phân loại ({formatCurrency(totalClassifiedAmount)}) chưa khớp tổng tiền danh sách ({formatCurrency(grandTotalAmount)}).</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Phần bên phải: Tổng tiền & Nút xuất 01 File Excel */}
        <div className="confirmation-action-col">
          <div className="total-amount-box">
            <span className="total-label">Tổng tiền hồ sơ xuất (chưa VAT)</span>
            <span className={`total-value font-mono ${isReady ? 'text-navy' : 'text-muted'}`}>
              {formatCurrency(isReady ? totalClassifiedAmount : grandTotalAmount)}
            </span>
            <span className="total-subtext">
              {isReady
                ? `Khớp 100% giữa Sheet PHIẾU TRÌNH và Sheet BẢNG KÊ`
                : `Đã phân loại: ${formatCurrency(totalClassifiedAmount)} / ${formatCurrency(grandTotalAmount)}`}
            </span>
          </div>

          <button
            type="button"
            className={`btn-export-final ${isReady ? 'btn-ready' : 'btn-auto-action'}`}
            disabled={isExporting}
            onClick={onExport}
            title={
              isReady
                ? 'Tải xuống duy nhất 01 File Excel gồm đúng 02 Sheet (PHIẾU TRÌNH & BẢNG KÊ)'
                : 'Xác nhận phân loại và tải ngay 01 File Excel (gồm đúng 02 Sheet)'
            }
          >
            <FileSpreadsheet size={20} />
            <div className="btn-text-group">
              <span className="btn-main-title">
                {isExporting ? 'ĐANG XUẤT 01 FILE EXCEL...' : 'XÁC NHẬN VÀ TẢI 01 FILE EXCEL'}
              </span>
              <span className="btn-sub-title">Gồm đúng 02 Sheet: 1. PHIẾU TRÌNH & 2. BẢNG KÊ</span>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
}
