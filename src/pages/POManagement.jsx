import React, { useState, useMemo } from 'react';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { formatCurrency, formatNumber } from '../utils/currencyUtils.js';
import { formatExcelDate, todayYMD } from '../utils/dateUtils.js';
import { WORKFLOW_STAGES } from '../utils/constants.js';
import { normalizeText } from '../utils/validation.js';
import {
  Search,
  Filter,
  FileDown,
  Trash2,
  ExternalLink,
  X,
  Clock,
  CheckCircle,
  Truck,
  AlertOctagon,
  Calendar,
  User,
  Building,
  FileText
} from 'lucide-react';

export function POManagement({
  pos = [],
  activePOId,
  onSetActivePOId,
  onUpdateStatus,
  onUpdateOrderInfo,
  onExportPO,
  onDeletePO,
  isExporting
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Lọc và tìm kiếm PO
  const filteredPOs = useMemo(() => {
    const q = normalizeText(searchTerm);
    return pos.filter(p => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (q) {
        const itemNames = (p.items || []).map(x => `${x.unit} ${x.item} ${x.supplier} ${x.msp}`).join(' ');
        const full = normalizeText(`${p.po} ${p.requester} ${p.note} ${itemNames}`);
        if (!full.includes(q)) return false;
      }
      return true;
    });
  }, [pos, searchTerm, statusFilter]);

  const activePO = pos.find(p => p.id === activePOId) || null;

  // State cho form chỉnh sửa đặt hàng trong modal
  const [orderSupplier, setOrderSupplier] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [receivedQty, setReceivedQty] = useState(0);
  const [editNote, setEditNote] = useState('');

  // Đồng bộ form khi activePO thay đổi
  const handleOpenModal = (po) => {
    onSetActivePOId(po.id);
    setOrderSupplier(po.orderSupplier || po.items?.[0]?.supplier || '');
    setOrderNo(po.orderNo || '');
    setOrderDate(po.orderDate || todayYMD());
    setReceivedQty(po.receivedQty || 0);
    setEditNote(po.note || '');
  };

  const handleCloseModal = () => {
    onSetActivePOId(null);
  };

  // Tổng số lượng và tổng tiền của PO đang mở
  const activePOTotalQty = activePO ? (activePO.items || []).reduce((s, x) => s + (Number(x.qty) || 0), 0) : 0;
  const activePOTotalAmount = activePO ? (activePO.items || []).reduce((s, x) => s + (Number(x.amount) || 0), 0) : 0;

  return (
    <div className="page-container po-management-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Hồ sơ PO & Quy trình Phê duyệt</h1>
          <p className="page-subtitle">Theo dõi vòng đời hồ sơ từ trình ký, phê duyệt, đặt hàng đến giao nhận</p>
        </div>
      </div>

      {/* Bộ lọc và tìm kiếm */}
      <div className="table-filter-bar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Tìm theo mã PO, người đề xuất, nội dung hàng hóa, nhà cung cấp..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-dropdowns">
          <div className="filter-select-wrapper">
            <Filter size={14} className="filter-icon" />
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái ({pos.length})</option>
              {WORKFLOW_STAGES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Danh sách các hồ sơ PO */}
      <div className="content-card">
        {filteredPOs.length === 0 ? (
          <div className="empty-state-box">
            <FileText size={48} className="text-muted" />
            <p>Không có hồ sơ nào phù hợp với điều kiện tìm kiếm.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="procurement-table">
              <thead>
                <tr>
                  <th>Mã PO</th>
                  <th>Ngày lập</th>
                  <th>Người đề xuất</th>
                  <th>Đơn vị đại diện</th>
                  <th>Số sản phẩm</th>
                  <th>Tổng giá trị chưa VAT</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredPOs.map(po => {
                  const poTotal = (po.items || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
                  const firstUnit = po.items?.[0]?.unit || '—';
                  return (
                    <tr key={po.id}>
                      <td className="font-mono font-bold text-navy">{po.po}</td>
                      <td>{formatExcelDate(po.date)}</td>
                      <td>{po.requester || '—'}</td>
                      <td>{firstUnit}</td>
                      <td className="text-center font-medium">{po.items?.length || 0}</td>
                      <td className="font-bold">{formatCurrency(poTotal)}</td>
                      <td>
                        <StatusBadge status={po.status} />
                      </td>
                      <td>
                        <div className="flex-align gap-2">
                          <button
                            type="button"
                            className="btn-table-action"
                            onClick={() => handleOpenModal(po)}
                          >
                            Xử lý / Chi tiết
                            <ExternalLink size={14} style={{ marginLeft: 4 }} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => onExportPO(po.id)}
                            title="Xuất lại 2 file Excel"
                            disabled={isExporting}
                          >
                            <FileDown size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon btn-icon-danger"
                            onClick={() => {
                              if (confirm(`Bạn có chắc chắn muốn xóa hồ sơ ${po.po}?`)) {
                                onDeletePO(po.id);
                              }
                            }}
                            title="Xóa hồ sơ"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal chi tiết hồ sơ & workflow */}
      {activePO && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-dialog modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <h3 className="modal-title">Chi tiết Hồ sơ PO: {activePO.po}</h3>
                <StatusBadge status={activePO.status} />
              </div>
              <button type="button" className="modal-close-btn" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Timeline tiến trình Workflow */}
              <div className="workflow-timeline-card">
                <div className="workflow-step-track">
                  {WORKFLOW_STAGES.filter(s => s !== 'Từ chối').map((stage, idx) => {
                    const currentIdx = WORKFLOW_STAGES.indexOf(activePO.status);
                    const isDone = currentIdx >= idx && activePO.status !== 'Từ chối';
                    const isCurrent = activePO.status === stage;
                    return (
                      <div key={stage} className={`timeline-node ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                        <div className="node-circle">
                          {isDone ? <CheckCircle size={14} /> : idx + 1}
                        </div>
                        <span className="node-label">{stage}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tóm tắt thông tin hồ sơ */}
              <div className="po-details-grid">
                <div className="detail-item">
                  <span className="detail-label"><Calendar size={14} /> Ngày tạo hồ sơ:</span>
                  <span className="detail-value">{formatExcelDate(activePO.date)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label"><User size={14} /> Người đề xuất:</span>
                  <span className="detail-value">{activePO.requester || 'Chưa nhập'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label"><Building size={14} /> Nhóm thanh toán:</span>
                  <span className="detail-value">
                    {activePO.payGroup === 'B' ? 'B. Đơn vị thanh toán' : 'A. Hội sở thanh toán'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label"><Clock size={14} /> Tổng giá trị chưa VAT:</span>
                  <span className="detail-value font-bold text-navy">
                    {formatCurrency(activePOTotalAmount)} ({activePOTotalQty} sản phẩm)
                  </span>
                </div>
              </div>

              {/* Bảng danh sách hàng hóa trong hồ sơ */}
              <div className="modal-section">
                <h4 className="section-title">Danh sách hàng hóa chi tiết ({activePO.items?.length || 0} dòng)</h4>
                <div className="table-responsive max-h-300">
                  <table className="procurement-table">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>Đơn vị</th>
                        <th>Nội dung</th>
                        <th>SL</th>
                        <th>Đơn giá</th>
                        <th>Thành tiền chưa VAT</th>
                        <th>Mục đích</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activePO.items || []).map((x, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{x.unit}</td>
                          <td>
                            <div className="font-medium">{x.item}</div>
                            {x.msp && <div className="text-muted text-xs">MSP: {x.msp}</div>}
                          </td>
                          <td className="text-center font-medium">{x.qty}</td>
                          <td className="text-right">{formatNumber(x.price)}</td>
                          <td className="text-right font-bold">{formatCurrency(x.amount)}</td>
                          <td className="text-xs">{x.purpose || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Khu vực hành động theo trạng thái */}
              <div className="modal-actions-bar">
                {activePO.status === 'Chờ trình ký' && (
                  <button
                    type="button"
                    className="btn-workflow btn-primary"
                    onClick={() => onUpdateStatus(activePO.id, 'Đã trình ký')}
                  >
                    Gửi trình ký hồ sơ
                  </button>
                )}

                {activePO.status === 'Đã trình ký' && (
                  <>
                    <button
                      type="button"
                      className="btn-workflow btn-success"
                      onClick={() => onUpdateStatus(activePO.id, 'Đã duyệt')}
                    >
                      Phê duyệt hồ sơ
                    </button>
                    <button
                      type="button"
                      className="btn-workflow btn-danger"
                      onClick={() => {
                        const reason = prompt('Lý do từ chối hồ sơ:');
                        if (reason) onUpdateStatus(activePO.id, 'Từ chối', reason);
                      }}
                    >
                      Từ chối / Trả lại
                    </button>
                  </>
                )}

                {activePO.status === 'Đã duyệt' && (
                  <div className="order-form-compact">
                    <div className="form-group">
                      <label className="form-label">Nhà cung cấp</label>
                      <input
                        type="text"
                        className="form-input"
                        value={orderSupplier}
                        onChange={(e) => setOrderSupplier(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Số PO NCC</label>
                      <input
                        type="text"
                        className="form-input"
                        value={orderNo}
                        onChange={(e) => setOrderNo(e.target.value)}
                        placeholder="Số đơn hàng"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-workflow btn-primary"
                      onClick={() => {
                        onUpdateOrderInfo(activePO.id, {
                          orderSupplier,
                          orderNo,
                          orderDate: orderDate || todayYMD(),
                          status: 'Đã đặt hàng'
                        });
                      }}
                    >
                      Chuyển sang "Đã đặt hàng"
                    </button>
                  </div>
                )}

                {activePO.status === 'Đã đặt hàng' && (
                  <div className="receive-form-compact">
                    <div className="form-group">
                      <label className="form-label">Số lượng đã nhận (Tổng: {activePOTotalQty})</label>
                      <input
                        type="number"
                        className="form-input"
                        value={receivedQty}
                        onChange={(e) => setReceivedQty(Number(e.target.value))}
                        max={activePOTotalQty}
                        min={0}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-workflow btn-success"
                      onClick={() => {
                        onUpdateOrderInfo(activePO.id, {
                          receivedQty,
                          status: 'Đã nhận hàng'
                        });
                      }}
                    >
                      Xác nhận đã nhận hàng
                    </button>
                  </div>
                )}

                {activePO.status === 'Đã nhận hàng' && (
                  <button
                    type="button"
                    className="btn-workflow btn-success"
                    onClick={() => onUpdateStatus(activePO.id, 'Hoàn tất')}
                  >
                    Hoàn tất toàn bộ hồ sơ
                  </button>
                )}

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => onExportPO(activePO.id)}
                  disabled={isExporting}
                >
                  <FileDown size={16} />
                  Xuất lại 2 file Excel
                </button>
              </div>

              {/* Lịch sử xử lý logs */}
              <div className="modal-section">
                <h4 className="section-title">Lịch sử xử lý & nhật ký hồ sơ</h4>
                <div className="logs-list">
                  {(activePO.logs || []).map((log, i) => (
                    <div key={i} className="log-item">
                      <span className="log-time">{log.time}</span>
                      <span className="log-divider">—</span>
                      <span className="log-text">{log.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
