import React from 'react';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { formatCurrency, formatNumber } from '../utils/currencyUtils.js';
import { formatExcelDate } from '../utils/dateUtils.js';
import {
  FileText,
  Clock,
  Truck,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  PlusCircle,
  ExternalLink
} from 'lucide-react';

export function Dashboard({ pos = [], onNavigate, onOpenPO }) {
  // Tính toán số liệu thống kê KPI
  const totalCount = pos.length;
  const pendingCount = pos.filter(p => ['Chờ trình ký', 'Đã trình ký'].includes(p.status)).length;
  const orderingCount = pos.filter(p => p.status === 'Đã đặt hàng').length;
  const completedCount = pos.filter(p => p.status === 'Hoàn tất' || p.status === 'Đã nhận hàng').length;

  const totalValue = pos.reduce((sum, p) => {
    return sum + (p.items || []).reduce((itemSum, x) => itemSum + (Number(x.amount) || 0), 0);
  }, 0);

  const recentPOs = [...pos]
    .sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0))
    .slice(0, 6);

  return (
    <div className="page-container dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tổng quan Quản trị Mua sắm & Trình ký QTTS</h1>
          <p className="page-subtitle">Theo dõi quy trình lập phiếu, duyệt trình ký và quản lý đơn đặt hàng</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => onNavigate('import')}
        >
          <PlusCircle size={18} />
          Nhập file Excel & Tạo PO mới
        </button>
      </div>

      {/* Thẻ KPI */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box bg-blue-subtle text-blue">
            <FileText size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Tổng hồ sơ PO</span>
            <span className="kpi-value">{totalCount}</span>
            <span className="kpi-desc">Tổng số hồ sơ đã tạo</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box bg-warning-subtle text-warning">
            <Clock size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Chờ trình ký / Đã trình</span>
            <span className="kpi-value">{pendingCount}</span>
            <span className="kpi-desc">Cần phê duyệt</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box bg-purple-subtle text-purple">
            <Truck size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Đang đặt hàng</span>
            <span className="kpi-value">{orderingCount}</span>
            <span className="kpi-desc">Đang giao nhận</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box bg-success-subtle text-success">
            <CheckCircle2 size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Đã hoàn tất</span>
            <span className="kpi-value">{completedCount}</span>
            <span className="kpi-desc">Đã giao nhận đủ</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-highlight">
          <div className="kpi-icon-box bg-white text-navy">
            <DollarSign size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Tổng giá trị đề xuất (chưa VAT)</span>
            <span className="kpi-value">{formatCurrency(totalValue)}</span>
            <span className="kpi-desc">Toàn hệ thống</span>
          </div>
        </div>
      </div>

      {/* Danh sách hồ sơ gần đây */}
      <div className="content-card">
        <div className="card-header-flex">
          <h2 className="card-title">Hồ sơ mua sắm xử lý gần đây</h2>
          <button
            type="button"
            className="btn-link"
            onClick={() => onNavigate('pos')}
          >
            Xem tất cả hồ sơ PO &rarr;
          </button>
        </div>

        {recentPOs.length === 0 ? (
          <div className="empty-state-box">
            <FileText size={48} className="text-muted" />
            <p>Chưa có hồ sơ mua sắm nào. Vui lòng tải lên file Excel phiếu thô để bắt đầu.</p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate('import')}
              style={{ marginTop: 12 }}
            >
              Tải lên file Excel ngay
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="procurement-table">
              <thead>
                <tr>
                  <th>Mã PO</th>
                  <th>Ngày lập</th>
                  <th>Người đề xuất</th>
                  <th>Số dòng</th>
                  <th>Tổng giá trị chưa VAT</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {recentPOs.map(po => {
                  const poTotal = (po.items || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
                  return (
                    <tr key={po.id}>
                      <td className="font-mono font-bold text-navy">{po.po}</td>
                      <td>{formatExcelDate(po.date)}</td>
                      <td>{po.requester || '—'}</td>
                      <td className="text-center">{po.items?.length || 0}</td>
                      <td className="font-bold">{formatCurrency(poTotal)}</td>
                      <td>
                        <StatusBadge status={po.status} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={() => onOpenPO(po.id)}
                        >
                          Chi tiết & Workflow
                          <ExternalLink size={14} style={{ marginLeft: 4 }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
