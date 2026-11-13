/**
 * Utility tính toán mốc thời gian và SLA vòng đời hồ sơ PO chuẩn Section III
 */

export function formatDuration(ms) {
  if (ms === null || ms === undefined || isNaN(ms) || ms < 0) return '—';
  const totalMinutes = Math.floor(ms / (1000 * 60));
  if (totalMinutes < 1) return 'Dưới 1 phút';
  if (totalMinutes < 60) return `${totalMinutes} phút`;
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours} giờ ${remainingMinutes} phút` : `${hours} giờ`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours > 0) {
    return `${days} ngày ${remainingHours} giờ`;
  }
  return `${days} ngày`;
}

export function calculatePOTimings(po) {
  const createdAt = po.created_at ? new Date(po.created_at) : (po.created ? new Date(po.created) : null);
  const submittedAt = po.submitted_at ? new Date(po.submitted_at) : null;
  const approvedAt = po.approved_at ? new Date(po.approved_at) : null;
  const rejectedAt = po.rejected_at ? new Date(po.rejected_at) : null;
  const orderedAt = po.ordered_at ? new Date(po.ordered_at) : null;
  const completedAt = po.completed_at ? new Date(po.completed_at) : null;

  // 1. Thời gian từ tạo PO đến gửi trình
  let createdToSubmitMs = null;
  if (createdAt && submittedAt) {
    createdToSubmitMs = Math.max(0, submittedAt.getTime() - createdAt.getTime());
  }

  // 2. Thời gian trình ký (chính xác: từ submitted_at đến approved_at của phiên thành công cuối cùng)
  let approvalDurationMs = null;
  let approvalStatusText = 'Chưa trình ký';
  if (submittedAt && approvedAt) {
    approvalDurationMs = Math.max(0, approvedAt.getTime() - submittedAt.getTime());
    approvalStatusText = 'Đã duyệt';
  } else if (submittedAt && rejectedAt && (!approvedAt || rejectedAt > approvedAt)) {
    approvalDurationMs = Math.max(0, rejectedAt.getTime() - submittedAt.getTime());
    approvalStatusText = 'Từ chối';
  } else if (submittedAt) {
    approvalDurationMs = Math.max(0, Date.now() - submittedAt.getTime());
    approvalStatusText = 'Đang trình ký';
  }

  // 3. Thời gian từ duyệt đến đặt hàng
  let approvedToOrderMs = null;
  if (approvedAt && orderedAt) {
    approvedToOrderMs = Math.max(0, orderedAt.getTime() - approvedAt.getTime());
  }

  // 4. Tổng thời gian xử lý
  let totalProcessingMs = null;
  if (createdAt) {
    const endPoint = completedAt || (po.status === 'Hoàn tất' || po.po_status === 'HOAN_TAT' ? new Date(po.updated_at || Date.now()) : new Date());
    totalProcessingMs = Math.max(0, endPoint.getTime() - createdAt.getTime());
  }

  return {
    createdAt,
    submittedAt,
    approvedAt,
    rejectedAt,
    orderedAt,
    completedAt,
    createdToSubmitText: formatDuration(createdToSubmitMs),
    approvalDurationText: formatDuration(approvalDurationMs),
    approvedToOrderText: formatDuration(approvedToOrderMs),
    totalProcessingText: formatDuration(totalProcessingMs),
    approvalDurationMs,
    approvalStatusText
  };
}
