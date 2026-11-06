import React from 'react';
import { formatCurrency, formatNumber } from '../utils/currencyUtils.js';
import { WORKFLOW_STAGES } from '../utils/constants.js';
import { storageService } from '../services/storageService.js';
import {
  BarChart3,
  PieChart,
  Building2,
  Users,
  RefreshCw,
  Trash2,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';

export function ReportPage({ pos = [], onSeedDemo, onRefresh }) {
  // Tổng hợp giá trị & số lượng
  const totalValue = pos.reduce((sum, p) => {
    return sum + (p.items || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  }, 0);

  const totalLines = pos.reduce((sum, p) => sum + (p.items?.length || 0), 0);
  const totalQty = pos.reduce((sum, p) => {
    return sum + (p.items || []).reduce((s, x) => s + (Number(x.qty) || 0), 0);
  }, 0);

  // Thống kê theo NCC
  const supplierStats = {};
  pos.forEach(p => {
    (p.items || []).forEach(x => {
      const sup = (x.supplier || 'Chưa xác định').trim();
      if (!supplierStats[sup]) {
        supplierStats[sup] = { count: 0, amount: 0, qty: 0 };
      }
      supplierStats[sup].count += 1;
      supplierStats[sup].qty += Number(x.qty) || 0;
      supplierStats[sup].amount += Number(x.amount) || 0;
    });
  });

  const sortedSuppliers = Object.entries(supplierStats)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 8);

  // Thống kê theo Trạng thái
  const maxStatusCount = Math.max(1, ...WORKFLOW_STAGES.map(s => pos.filter(p => p.status === s).length));

  return (
    <div className="page-container report-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Báo cáo Thống kê & Phân tích Mua sắm QTTS</h1>
          <p className="page-subtitle">Thống kê giá trị hàng hóa, tỷ lệ xử lý và phân bổ nhà cung cấp</p>
        </div>
        <div className="flex-align gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={onSeedDemo}
            title="Nạp 3 hồ sơ mẫu vào hệ thống để thử nghiệm"
          >
            <RefreshCw size={15} />
            Nạp dữ liệu mẫu
          </button>
          <button
            type="button"
            className="btn-danger-outline"
            onClick={() => {
              if (confirm('Bạn có chắc chắn muốn xóa toàn bộ hồ sơ trong bộ nhớ máy này?')) {
                storageService.clearAll();
                onRefresh();
              }
            }}
            title="Xóa trắng bộ nhớ test"
          >
            <Trash2 size={15} />
            Xóa dữ liệu
          </button>
        </div>
      </div>

      {/* Thẻ số liệu tổng quát */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box bg-blue-subtle text-blue">
            <TrendingUp size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Tổng giá trị mua sắm</span>
            <span className="kpi-value">{formatCurrency(totalValue)}</span>
            <span className="kpi-desc">Chưa bao gồm VAT</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box bg-purple-subtle text-purple">
            <BarChart3 size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Tổng dòng hàng hóa</span>
            <span className="kpi-value">{formatNumber(totalLines)}</span>
            <span className="kpi-desc">Mục danh mục tài sản</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box bg-success-subtle text-success">
            <CheckCircle2 size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Tổng số lượng tài sản (SL)</span>
            <span className="kpi-value">{formatNumber(totalQty)}</span>
            <span className="kpi-desc">Sản phẩm, thiết bị</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box bg-navy-subtle text-navy">
            <Users size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Số nhà cung cấp</span>
            <span className="kpi-value">{Object.keys(supplierStats).length}</span>
            <span className="kpi-desc">Đối tác tham gia</span>
          </div>
        </div>
      </div>

      {/* Hai cột biểu đồ: Trạng thái & Nhà cung cấp */}
      <div className="report-two-cols">
        {/* Cột 1: Phân bổ trạng thái */}
        <div className="content-card">
          <h2 className="card-title">Tiến độ quy trình theo trạng thái</h2>
          <div className="status-bars-container">
            {WORKFLOW_STAGES.map(stage => {
              const count = pos.filter(p => p.status === stage).length;
              const percent = (count / maxStatusCount) * 100;
              return (
                <div key={stage} className="status-bar-row">
                  <div className="status-bar-header">
                    <span className="status-name">{stage}</span>
                    <span className="status-count"><b>{count}</b> hồ sơ</span>
                  </div>
                  <div className="status-bar-track">
                    <div
                      className={`status-bar-fill fill-${stage.replace(/\s+/g, '-').toLowerCase()}`}
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cột 2: Top nhà cung cấp có giá trị lớn nhất */}
        <div className="content-card">
          <h2 className="card-title">Top Nhà cung cấp theo giá trị (chưa VAT)</h2>
          {sortedSuppliers.length === 0 ? (
            <div className="empty-state-box">
              <p>Chưa có dữ liệu nhà cung cấp.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="procurement-table">
                <thead>
                  <tr>
                    <th>Nhà cung cấp</th>
                    <th>Số mục</th>
                    <th>Tổng SL</th>
                    <th>Tổng giá trị chưa VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSuppliers.map(([sup, stat]) => (
                    <tr key={sup}>
                      <td className="font-medium">{sup}</td>
                      <td className="text-center">{stat.count}</td>
                      <td className="text-center">{stat.qty}</td>
                      <td className="font-bold text-right">{formatCurrency(stat.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
