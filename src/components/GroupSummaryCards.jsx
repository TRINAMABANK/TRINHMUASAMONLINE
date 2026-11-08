import React from 'react';
import { formatCurrency } from '../utils/currencyUtils.js';
import {
  Landmark,
  Building2,
  CheckCircle,
  AlertCircle,
  Eye,
  RotateCcw,
  Layers,
  FileCheck2
} from 'lucide-react';

/**
 * Hiển thị 2 khu vực nhóm hồ sơ sau khi ACCEPT:
 * - Nhóm Hội sở thanh toán
 * - Nhóm Đơn vị thanh toán
 * Cho phép xem lại dữ liệu và kiểm tra trước khi xuất
 */
export function GroupSummaryCards({
  rows = [],
  activeFilter = '',
  onFilterChange,
  onUnclassifyGroup
}) {
  const itemsHO = rows.filter(r => r.payGroup === 'HOI_SO');
  const countHO = itemsHO.length;
  const amountHO = itemsHO.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const qtyHO = itemsHO.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);

  const itemsDV = rows.filter(r => r.payGroup === 'DON_VI');
  const countDV = itemsDV.length;
  const amountDV = itemsDV.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const qtyDV = itemsDV.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);

  const itemsUnassigned = rows.filter(r => !r.payGroup);
  const countUnassigned = itemsUnassigned.length;
  const amountUnassigned = itemsUnassigned.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const totalClassifiedCount = countHO + countDV;
  const totalClassifiedAmount = amountHO + amountDV;

  const handleResetGroup = (groupType, groupName) => {
    const ok = window.confirm(
      `XÁC NHẬN HỦY NHÓM:\n` +
      `Bạn có chắc chắn muốn hủy phân loại tất cả các dòng trong nhóm "${groupName}" không?\n` +
      `Các dòng này sẽ quay lại trạng thái Chưa phân loại.`
    );
    if (ok) {
      onUnclassifyGroup(groupType);
    }
  };

  return (
    <div className="group-summary-wrapper">
      {/* Tiêu đề & Tổng quan hồ sơ */}
      <div className="group-summary-header">
        <div className="summary-title-area">
          <FileCheck2 size={20} className="title-icon" />
          <div>
            <h3 className="summary-title">Kết Quả Phân Loại Nhóm Hồ Sơ Trình Ký</h3>
            <p className="summary-subtitle">
              Đã phân loại <b>{totalClassifiedCount}</b> / {rows.length} dòng hàng hóa
              (Tổng hồ sơ: <span className="text-navy font-bold">{formatCurrency(totalClassifiedAmount)}</span>)
            </p>
          </div>
        </div>

        {/* Tab lọc nhanh để xem lại dữ liệu */}
        <div className="quick-filter-tabs">
          <button
            type="button"
            className={`tab-btn ${activeFilter === '' ? 'active' : ''}`}
            onClick={() => onFilterChange('')}
          >
            Tất cả ({rows.length})
          </button>
          <button
            type="button"
            className={`tab-btn tab-unassigned ${activeFilter === 'UNASSIGNED' ? 'active' : ''}`}
            onClick={() => onFilterChange('UNASSIGNED')}
          >
            Chưa gán ({countUnassigned})
          </button>
          <button
            type="button"
            className={`tab-btn tab-ho ${activeFilter === 'HOI_SO' ? 'active' : ''}`}
            onClick={() => onFilterChange('HOI_SO')}
          >
            Hội sở ({countHO})
          </button>
          <button
            type="button"
            className={`tab-btn tab-dv ${activeFilter === 'DON_VI' ? 'active' : ''}`}
            onClick={() => onFilterChange('DON_VI')}
          >
            Đơn vị ({countDV})
          </button>
        </div>
      </div>

      {/* Hai khu vực nhóm thanh toán hiển thị trực quan */}
      <div className="group-cards-grid">
        {/* KHU VỰC 1: HỘI SỞ THANH TOÁN */}
        <div className={`group-card card-ho ${countHO > 0 ? 'has-data' : 'empty'} ${activeFilter === 'HOI_SO' ? 'card-active' : ''}`}>
          <div className="card-top">
            <div className="card-badge-row">
              <span className="group-pill pill-ho">
                <Landmark size={14} />
                NHÓM HỘI SỞ THANH TOÁN
              </span>
              <span className="group-code">Mã: HOI_SO</span>
            </div>
            {countHO > 0 && onUnclassifyGroup && (
              <button
                type="button"
                className="btn-card-reset"
                onClick={() => handleResetGroup('HOI_SO', 'Hội sở thanh toán')}
                title="Hủy toàn bộ dòng đã gán vào Hội sở"
              >
                <RotateCcw size={12} />
                Hủy nhóm
              </button>
            )}
          </div>

          <div className="card-metrics">
            <div className="metric-row">
              <span className="metric-label">Số dòng hàng hóa:</span>
              <span className="metric-value font-mono">{countHO} dòng</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Tổng số lượng:</span>
              <span className="metric-value font-mono">{qtyHO}</span>
            </div>
            <div className="metric-row amount-row">
              <span className="metric-label">Tổng tiền chưa VAT:</span>
              <span className="metric-value metric-amount">{formatCurrency(amountHO)}</span>
            </div>
          </div>

          <div className="card-footer">
            <button
              type="button"
              className="btn-card-view"
              onClick={() => onFilterChange(activeFilter === 'HOI_SO' ? '' : 'HOI_SO')}
            >
              <Eye size={14} />
              {activeFilter === 'HOI_SO' ? 'Đang lọc xem dòng Hội sở (Nhấn để bỏ lọc)' : 'Xem lại dữ liệu Hội sở'}
            </button>
          </div>
        </div>

        {/* KHU VỰC 2: ĐƠN VỊ THANH TOÁN */}
        <div className={`group-card card-dv ${countDV > 0 ? 'has-data' : 'empty'} ${activeFilter === 'DON_VI' ? 'card-active' : ''}`}>
          <div className="card-top">
            <div className="card-badge-row">
              <span className="group-pill pill-dv">
                <Building2 size={14} />
                NHÓM ĐƠN VỊ THANH TOÁN
              </span>
              <span className="group-code">Mã: DON_VI</span>
            </div>
            {countDV > 0 && onUnclassifyGroup && (
              <button
                type="button"
                className="btn-card-reset"
                onClick={() => handleResetGroup('DON_VI', 'Đơn vị thanh toán')}
                title="Hủy toàn bộ dòng đã gán vào Đơn vị"
              >
                <RotateCcw size={12} />
                Hủy nhóm
              </button>
            )}
          </div>

          <div className="card-metrics">
            <div className="metric-row">
              <span className="metric-label">Số dòng hàng hóa:</span>
              <span className="metric-value font-mono">{countDV} dòng</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Tổng số lượng:</span>
              <span className="metric-value font-mono">{qtyDV}</span>
            </div>
            <div className="metric-row amount-row">
              <span className="metric-label">Tổng tiền chưa VAT:</span>
              <span className="metric-value metric-amount">{formatCurrency(amountDV)}</span>
            </div>
          </div>

          <div className="card-footer">
            <button
              type="button"
              className="btn-card-view"
              onClick={() => onFilterChange(activeFilter === 'DON_VI' ? '' : 'DON_VI')}
            >
              <Eye size={14} />
              {activeFilter === 'DON_VI' ? 'Đang lọc xem dòng Đơn vị (Nhấn để bỏ lọc)' : 'Xem lại dữ liệu Đơn vị'}
            </button>
          </div>
        </div>
      </div>

      {/* Thông báo tiến độ nếu còn dòng chưa gán */}
      {countUnassigned > 0 && (
        <div className="unassigned-notice-bar">
          <AlertCircle size={16} className="notice-icon" />
          <div className="notice-text">
            Còn <b>{countUnassigned}</b> dòng chưa được phân loại ({formatCurrency(amountUnassigned)}).
            Hãy tick chọn các dòng và nhấn <b>ACCEPT</b> để gán vào nhóm thích hợp trước khi xuất hồ sơ.
          </div>
          <button
            type="button"
            className="btn-notice-filter"
            onClick={() => onFilterChange(activeFilter === 'UNASSIGNED' ? '' : 'UNASSIGNED')}
          >
            {activeFilter === 'UNASSIGNED' ? 'Bỏ lọc' : 'Lọc dòng chưa gán'}
          </button>
        </div>
      )}
    </div>
  );
}
