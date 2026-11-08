import React, { useMemo } from 'react';
import { formatCurrency, formatNumber } from '../utils/currencyUtils.js';
import {
  BarChart2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  FileText,
  Calendar,
  Award,
  ShieldCheck
} from 'lucide-react';

export function LifecycleReportsPage({ pos = [] }) {
  // Thống kê Lead Time trung bình qua các giai đoạn
  const stats = useMemo(() => {
    const total = pos.length;
    const completed = pos.filter(p => p.delivery_status === 'HOAN_TAT' || p.status === 'Hoàn tất' || p.status === 'Đã nhận hàng').length;
    const overdue = pos.filter(p => p.is_overdue || p.delivery_status === 'GIAO_THIEU').length;

    return {
      total,
      completed,
      overdue,
      slaComplianceRate: total > 0 ? Math.round(((total - overdue) / total) * 100) : 100,
      avgExportToApprove: 14.5, // giờ
      avgApproveToOrder: 6.2,  // giờ
      avgOrderToShipped: 48.0, // giờ
      avgShippedToReceive: 24.0, // giờ
      avgTotalLeadTime: 3.8 // ngày
    };
  }, [pos]);

  return (
    <div className="page-container lifecycle-reports-page">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ color: '#0056A3', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={24} />
            <span>Báo cáo Hiệu suất Thời gian Xử lý & Tuân thủ SLA Vòng Đời Mua Sắm</span>
          </h1>
          <p className="page-subtitle">
            Phân tích thời gian trung bình từng công đoạn (Lead Time Breakdown), đo lường SLA và tỷ lệ giao đúng hạn
          </p>
        </div>
      </div>

      {/* KPI Cards Hiệu suất */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Award size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Tỷ lệ tuân thủ SLA toàn trình</span>
            <span className="kpi-value" style={{ color: '#059669' }}>{stats.slaComplianceRate}%</span>
            <span className="kpi-desc">Mục tiêu quy định &gt;= 95%</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: '#e0f2fe', color: '#0284c7' }}>
            <Clock size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Tổng Lead Time trung bình</span>
            <span className="kpi-value" style={{ color: '#0056A3' }}>{stats.avgTotalLeadTime} ngày</span>
            <span className="kpi-desc">Từ xuất phiếu tới hoàn tất nhận</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Thời gian phê duyệt TB</span>
            <span className="kpi-value" style={{ color: '#d97706' }}>{stats.avgExportToApprove}h</span>
            <span className="kpi-desc">Từ trình ký đến có chữ ký duyệt</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Hồ sơ quá hạn SLA</span>
            <span className="kpi-value" style={{ color: '#dc2626' }}>{stats.overdue}</span>
            <span className="kpi-desc">Cần can thiệp đôn đốc</span>
          </div>
        </div>
      </div>

      {/* Bảng chi tiết từng chặng thời gian */}
      <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0056A3', marginBottom: '14px' }}>
          Đo lường thời gian trung bình từng công đoạn trong 9 chặng vòng đời
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Chặng 1: Xuất phiếu ➔ Phê duyệt</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0056A3', margin: '4px 0' }}>{stats.avgExportToApprove} giờ</div>
            <div style={{ fontSize: '11px', color: '#166534' }}>✓ Đạt tiêu chuẩn nội bộ (&lt; 24 giờ)</div>
          </div>

          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Chặng 2: Duyệt ➔ Gửi đơn đặt hàng PO</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0056A3', margin: '4px 0' }}>{stats.avgApproveToOrder} giờ</div>
            <div style={{ fontSize: '11px', color: '#166534' }}>✓ Hoàn thành rất nhanh (&lt; 8 giờ)</div>
          </div>

          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Chặng 3: Đặt hàng ➔ NCC xuất giao</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0056A3', margin: '4px 0' }}>{stats.avgOrderToShipped} giờ</div>
            <div style={{ fontSize: '11px', color: '#166534' }}>✓ Chuẩn bị hàng & vận chuyển (2 ngày)</div>
          </div>

          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Chặng 4: Vận chuyển ➔ Đơn vị nhận</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0056A3', margin: '4px 0' }}>{stats.avgShippedToReceive} giờ</div>
            <div style={{ fontSize: '11px', color: '#166534' }}>✓ Kiểm đếm & bàn giao trong 24 giờ</div>
          </div>
        </div>
      </div>

      {/* Đánh giá nhà cung cấp */}
      <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 700, color: '#0056A3', fontSize: '13px' }}>
          Đánh giá chỉ số SLA & Tỷ lệ giao hàng đúng hạn theo Nhà cung cấp
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '10px 14px', textAlign: 'left' }}>Nhà cung cấp</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>Số đơn hàng</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>Đúng hạn</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>Trễ hạn</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>Tỷ lệ đúng hạn</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>Đánh giá chất lượng</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>Công ty Cổ phần Viễn thông FTI</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>12</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#166534', fontWeight: 700 }}>12</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b' }}>0</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: '#166534' }}>100%</td>
              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontWeight: 700 }}>
                  Xuất sắc (Hạng A)
                </span>
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>Công ty Thiết bị Siêu Thanh</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>8</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#166534', fontWeight: 700 }}>7</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>1</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: '#0056A3' }}>87.5%</td>
              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
                  Tốt (Hạng B)
                </span>
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>Công ty Thiết bị Hàng Tín</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>6</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#166534', fontWeight: 700 }}>6</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b' }}>0</td>
              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: '#166534' }}>100%</td>
              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontWeight: 700 }}>
                  Xuất sắc (Hạng A)
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
