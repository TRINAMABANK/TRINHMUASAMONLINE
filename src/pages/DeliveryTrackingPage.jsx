import React, { useState, useMemo } from 'react';
import { formatCurrency, formatNumber } from '../utils/currencyUtils.js';
import {
  Truck,
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Phone,
  User,
  ArrowRight,
  Clock,
  Building
} from 'lucide-react';

export function DeliveryTrackingPage({ pos = [], onOpenPO, onNavigateToReceipt }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);

  const deliveryItems = useMemo(() => {
    const list = [];
    pos.forEach(po => {
      (po.items || []).forEach((item, idx) => {
        list.push({
          poId: po.id,
          poNumber: po.poNumber || po.po_number,
          title: po.title,
          itemId: item.id || idx,
          itemName: item.name,
          spec: item.spec,
          qty: Number(item.qty) || 0,
          receivedQty: Number(item.received_qty) || 0,
          unitName: item.unit || item.unit_name || 'Hội sở',
          supplierName: item.supplier || item.supplier_name || 'FTI Telecom',
          deliveryStatus: po.delivery_status || 'DANG_GIAO',
          expectedDate: po.expected_delivery_date || new Date(Date.now() + 86400000 * 2).toISOString(),
          isOverdue: po.is_overdue || false
        });
      });
    });

    return list.filter(item => {
      if (search) {
        const q = search.toLowerCase();
        const matchPo = item.poNumber.toLowerCase().includes(q);
        const matchItem = item.itemName.toLowerCase().includes(q);
        const matchUnit = item.unitName.toLowerCase().includes(q);
        const matchSup = item.supplierName.toLowerCase().includes(q);
        if (!matchPo && !matchItem && !matchUnit && !matchSup) return false;
      }
      if (filterStatus && item.deliveryStatus !== filterStatus) return false;
      if (filterOverdue && !item.isOverdue) return false;
      return true;
    });
  }, [pos, search, filterStatus, filterOverdue]);

  return (
    <div className="page-container delivery-tracking-page">
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ color: '#0056A3', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Truck size={24} />
            <span>Theo dõi Giao hàng & Quản lý Logistics Toàn Hệ Thống</span>
          </h1>
          <p className="page-subtitle">
            Giám sát vận chuyển hàng hóa từ kho Nhà cung cấp đến từng Chi nhánh, PGD, OneBank trên toàn quốc
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          background: '#ffffff',
          padding: '14px 18px',
          borderRadius: '8px',
          border: '1px solid #dce4ee',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Tìm theo mã PO, tên hàng, đơn vị nhận, nhà cung cấp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '32px', fontSize: '13px', height: '36px' }}
          />
        </div>

        <div style={{ width: '200px' }}>
          <select
            className="form-control"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ fontSize: '13px', height: '36px' }}
          >
            <option value="">-- Tất cả trạng thái --</option>
            <option value="DANG_GIAO">Đang giao hàng</option>
            <option value="DOI_TAC_DA_GIAO">NCC đã giao</option>
            <option value="HOAN_TAT">Đã nhận đủ hoàn tất</option>
            <option value="GIAO_THIEU">Giao thiếu / Ngoại lệ</option>
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: '#b91c1c', fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={filterOverdue}
            onChange={(e) => setFilterOverdue(e.target.checked)}
          />
          <span>Chỉ xem hàng quá hạn SLA</span>
        </label>
      </div>

      {/* Bảng theo dõi hàng đang giao */}
      <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #dce4ee', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0056A3' }}>
            Chi tiết các chuyến hàng đang vận chuyển & bàn giao ({deliveryItems.length} chuyến)
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Mã PO</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Mặt hàng vận chuyển</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Nhà cung cấp</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Đơn vị nhận hàng</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '90px' }}>SL Đặt / Nhận</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '110px' }}>Hẹn giao</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '110px' }}>Trạng thái</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '120px' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {deliveryItems.map((item, idx) => (
                <tr key={`${item.poId}-${item.itemId}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0056A3' }}>
                    {item.poNumber}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.itemName}</div>
                    {item.spec && <div style={{ fontSize: '11px', color: '#64748b' }}>{item.spec}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>
                    {item.supplierName}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#0056A3', fontWeight: 500 }}>
                    {item.unitName}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                    {item.receivedQty} / {item.qty}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>
                    {item.expectedDate ? new Date(item.expectedDate).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, background: item.deliveryStatus === 'HOAN_TAT' ? '#dcfce7' : item.deliveryStatus === 'DANG_GIAO' ? '#f3e8ff' : '#fffbeb', color: item.deliveryStatus === 'HOAN_TAT' ? '#166534' : item.deliveryStatus === 'DANG_GIAO' ? '#7e22ce' : '#92400e' }}>
                      {item.deliveryStatus === 'HOAN_TAT' ? 'Đã nhận đủ' : item.deliveryStatus === 'DANG_GIAO' ? 'Đang giao' : item.deliveryStatus}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn-sm btn-secondary"
                      onClick={() => onNavigateToReceipt && onNavigateToReceipt(item.poId)}
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                    >
                      Kiểm nhận
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
