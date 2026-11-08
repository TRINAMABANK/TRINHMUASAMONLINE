import React from 'react';
import {
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
  FileText,
  UserCheck,
  Send,
  Truck,
  PackageCheck,
  Flag,
  Calendar,
  AlertOctagon,
  ArrowRight
} from 'lucide-react';

const STAGE_CONFIGS = [
  { code: 'PHIEU_TRINH_XUAT', label: '1. Xuất phiếu trình', shortLabel: 'Xuất phiếu', icon: FileText },
  { code: 'CHO_DUYET', label: '2. Chờ phê duyệt', shortLabel: 'Chờ duyệt', icon: Clock },
  { code: 'DA_DUYET', label: '3. Đã phê duyệt', shortLabel: 'Đã duyệt', icon: UserCheck },
  { code: 'DA_DAT_HANG', label: '4. Đã đặt hàng (PO)', shortLabel: 'Đặt hàng', icon: Send },
  { code: 'DOI_TAC_XAC_NHAN', label: '5. NCC xác nhận đơn', shortLabel: 'NCC nhận đơn', icon: CheckCircle2 },
  { code: 'DANG_GIAO_HANG', label: '6. Đang vận chuyển', shortLabel: 'Đang giao', icon: Truck },
  { code: 'DOI_TAC_DA_GIAO', label: '7. NCC xác nhận đã giao', shortLabel: 'NCC đã giao', icon: Truck },
  { code: 'DON_VI_DA_NHAN', label: '8. Đơn vị xác nhận nhận', shortLabel: 'Đã nhận', icon: PackageCheck },
  { code: 'HOAN_TAT', label: '9. Hoàn tất đóng hồ sơ', shortLabel: 'Hoàn tất', icon: Flag }
];

export function TimelineView({ timelineData, isLoading }) {
  if (isLoading) {
    return (
      <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
        <Clock className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
        <div>Đang tải dòng thời gian xử lý hồ sơ...</div>
      </div>
    );
  }

  if (!timelineData) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
        Chưa có dữ liệu vòng đời cho hồ sơ này
      </div>
    );
  }

  const {
    current_stage,
    submission_status,
    po_status,
    delivery_status,
    durations = {},
    sla = {},
    stages = [],
    events = []
  } = timelineData;

  // Tìm index của stage hiện tại
  const currentStageIndex = STAGE_CONFIGS.findIndex(s => s.code === current_stage);
  const isOverdue = sla.is_overdue;

  // Kiểm tra bất thường
  const isException = ['HU_HONG', 'GIAO_SAI', 'GIAO_THIEU', 'DISCREPANCY_PENDING', 'TU_CHOI'].includes(delivery_status) ||
                      ['TU_CHOI', 'TAM_DUNG', 'HUY'].includes(po_status);

  return (
    <div className="lifecycle-timeline-box" style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', padding: '20px' }}>
      {/* Tiêu đề & Cảnh báo SLA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0056A3', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Vòng đời Mua sắm & Giao nhận</span>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1' }}>
              Chuẩn 9 công đoạn
            </span>
          </h3>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Thời gian đang chờ ở bước hiện tại: <strong style={{ color: '#0f172a' }}>{durations.current_waiting_hours ? `${durations.current_waiting_hours} giờ` : 'Đang xử lý'}</strong>
            {durations.total_lifecycle_days ? ` • Tổng thời gian thực hiện: ${durations.total_lifecycle_days} ngày` : ''}
          </p>
        </div>

        {/* SLA Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isOverdue ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '12px', fontWeight: 700 }}>
              <AlertOctagon size={16} />
              <span>CẢNH BÁO: Trễ hạn SLA {sla.days_overdue} ngày!</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#f0fdf4', color: '#166534', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '12px', fontWeight: 600 }}>
              <CheckCircle2 size={16} />
              <span>Tiến độ đúng hạn chuẩn SLA</span>
            </div>
          )}

          {sla.expected_delivery_date && (
            <div style={{ fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} color="#0056A3" />
              <span>Hẹn giao: <strong>{new Date(sla.expected_delivery_date).toLocaleDateString('vi-VN')}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Exception Banner nếu có */}
      {isException && (
        <div style={{ marginBottom: '18px', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px', color: '#92400e', fontSize: '12px' }}>
          <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
          <div>
            <strong>Lưu ý nghiệp vụ ngoại lệ: </strong>
            Hồ sơ đang ghi nhận trạng thái: <strong style={{ textDecoration: 'underline' }}>{delivery_status}</strong>. Đang chờ đối soát hoặc bổ sung hàng hóa để hoàn tất đóng hồ sơ PO.
          </div>
        </div>
      )}

      {/* 9-Stage Stepper Bar */}
      <div className="stepper-horizontal-container" style={{ overflowX: 'auto', paddingBottom: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', minWidth: '820px', alignItems: 'flex-start', position: 'relative' }}>
          {STAGE_CONFIGS.map((stage, idx) => {
            const stageData = stages.find(s => s.code === stage.code) || {};
            const isCompleted = stageData.is_completed || idx < currentStageIndex;
            const isCurrent = stage.code === current_stage;
            const isFuture = !isCompleted && !isCurrent;
            const IconComp = stage.icon;

            let circleBg = '#f1f5f9';
            let circleColor = '#94a3b8';
            let circleBorder = '#cbd5e1';

            if (isCompleted) {
              circleBg = '#0056A3';
              circleColor = '#ffffff';
              circleBorder = '#0056A3';
            } else if (isCurrent) {
              circleBg = isException ? '#ef4444' : '#FFD200';
              circleColor = isException ? '#ffffff' : '#1e293b';
              circleBorder = isException ? '#dc2626' : '#d97706';
            }

            return (
              <div key={stage.code} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {/* Connector line to next stage */}
                {idx < STAGE_CONFIGS.length - 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '16px',
                      left: '50%',
                      width: '100%',
                      height: '3px',
                      background: isCompleted ? '#0056A3' : '#e2e8f0',
                      zIndex: 1
                    }}
                  />
                )}

                {/* Circle Icon Node */}
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: circleBg,
                    color: circleColor,
                    border: `2px solid ${circleBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    boxShadow: isCurrent ? '0 0 0 4px rgba(255, 210, 0, 0.35)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                  title={stage.label}
                >
                  {isCompleted ? <CheckCircle2 size={16} /> : <IconComp size={15} />}
                </div>

                {/* Label & Date */}
                <div style={{ marginTop: '8px', textAlign: 'center', padding: '0 4px' }}>
                  <div style={{ fontSize: '11px', fontWeight: isCurrent ? 700 : isCompleted ? 600 : 500, color: isCurrent ? '#0056A3' : isCompleted ? '#1e293b' : '#94a3b8', lineHeight: 1.2 }}>
                    {stage.shortLabel}
                  </div>
                  {stageData.timestamp && (
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>
                      {new Date(stageData.timestamp).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hiệu suất thời gian từng chặng (Duration Chips) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #edf2f7', marginBottom: '18px' }}>
        <div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Trình ➔ Phê duyệt:</span>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0056A3' }}>
            {durations.export_to_approve_hours !== null ? `${durations.export_to_approve_hours} giờ` : '—'}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Duyệt ➔ Đặt hàng PO:</span>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0056A3' }}>
            {durations.approve_to_order_hours !== null ? `${durations.approve_to_order_hours} giờ` : '—'}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Đặt hàng ➔ NCC giao:</span>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0056A3' }}>
            {durations.order_to_shipped_hours !== null ? `${durations.order_to_shipped_hours} giờ` : '—'}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Giao ➔ Đơn vị nhận:</span>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0056A3' }}>
            {durations.shipped_to_received_hours !== null ? `${durations.shipped_to_received_hours} giờ` : '—'}
          </div>
        </div>
        <div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Tổng thời gian (Lead Time):</span>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#166534' }}>
            {durations.total_lifecycle_hours !== null ? `${durations.total_lifecycle_hours} giờ (${durations.total_lifecycle_days || 0} ngày)` : 'Đang thực hiện'}
          </div>
        </div>
      </div>

      {/* Nhật ký sự kiện vòng đời (Lifecycle Event Log) */}
      <div>
        <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>
          Nhật ký biến động trạng thái & Thao tác nghiệp vụ ({events.length})
        </h4>

        <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
          {events.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
              Chưa có sự kiện nào được ghi nhận
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Thời gian</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Người thực hiện</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Vai trò</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Chuyển trạng thái</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Nội dung ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => (
                  <tr key={ev.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {ev.event_time ? new Date(ev.event_time).toLocaleString('vi-VN') : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1e293b' }}>
                      {ev.actor_name || 'Hệ thống'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#e2e8f0', color: '#334155', fontWeight: 600 }}>
                        {ev.actor_role || 'SYSTEM'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#0056A3', fontWeight: 600 }}>
                      {ev.previous_status ? `${ev.previous_status} ➔ ` : ''}{ev.new_status}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#334155' }}>
                      {ev.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
