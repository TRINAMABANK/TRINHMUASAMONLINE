import React from 'react';
import { formatCurrency, formatNumber } from '../utils/currencyUtils.js';
import { formatExcelDate } from '../utils/dateUtils.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { storageService } from '../services/storageService.js';
import {
  FileSpreadsheet,
  Download,
  FileDown,
  Layers,
  Database,
  CheckCircle,
  FileCheck
} from 'lucide-react';

export function ExportPage({ pos = [], onExportPO, isExporting }) {
  // Xuất file tổng hợp CSV
  const handleExportCSV = () => {
    if (pos.length === 0) {
      alert('Chưa có hồ sơ nào để xuất báo cáo.');
      return;
    }

    const header = [
      'Mã PO',
      'Ngày tạo',
      'Người đề xuất',
      'Số sản phẩm',
      'Tổng SL',
      'Tổng tiền chưa VAT',
      'Trạng thái',
      'Nhà cung cấp'
    ];

    const rows = pos.map(p => {
      const totalAmount = (p.items || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
      const totalQty = (p.items || []).reduce((s, x) => s + (Number(x.qty) || 0), 0);
      const suppliers = [...new Set((p.items || []).map(x => x.supplier).filter(Boolean))].join('; ');
      return [
        p.po,
        p.date,
        p.requester,
        p.items?.length || 0,
        totalQty,
        totalAmount,
        p.status,
        suppliers
      ];
    });

    const csvContent = '\uFEFF' + [header, ...rows]
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Danh_Sach_Ho_So_PO_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="page-container export-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trung tâm Xuất File & Tài liệu Biểu mẫu (02 Sheet)</h1>
          <p className="page-subtitle">Xuất duy nhất 01 file Excel gồm 02 sheet: Sheet 1 - PHIẾU TRÌNH & Sheet 2 - BẢNG KÊ chuẩn mẫu QTTS</p>
        </div>
      </div>

      {/* Thẻ tải 2 file template gốc */}
      <div className="template-cards-grid">
        <div className="template-card">
          <div className="template-card-icon bg-blue-subtle text-blue">
            <FileSpreadsheet size={28} />
          </div>
          <div className="template-card-info">
            <h3 className="template-card-title">Mẫu 1: BẢNG TRÌNH KÝ</h3>
            <p className="template-card-desc">
              Giữ nguyên biểu mẫu PYC, logo, tiêu ngữ, thông tin ngân hàng và vùng chữ ký Lãnh đạo.
            </p>
            <a
              href="/templates/1_BANG_TRINH_KY.xlsx"
              download="1_BANG_TRINH_KY.xlsx"
              className="btn-download-template"
            >
              <Download size={15} />
              Tải file mẫu gốc (1_BANG_TRINH_KY.xlsx)
            </a>
          </div>
        </div>

        <div className="template-card">
          <div className="template-card-icon bg-navy-subtle text-navy">
            <FileSpreadsheet size={28} />
          </div>
          <div className="template-card-info">
            <h3 className="template-card-title">Mẫu 2: BẢNG KÊ CHI TIẾT</h3>
            <p className="template-card-desc">
              10 cột chuẩn, tự động dịch chuyển ô gộp tổng cộng & khu vực ký tên không bị vỡ bố cục.
            </p>
            <a
              href="/templates/2_BANG_KE.xlsx"
              download="2_BANG_KE.xlsx"
              className="btn-download-template"
            >
              <Download size={15} />
              Tải file mẫu gốc (2_BANG_KE.xlsx)
            </a>
          </div>
        </div>
      </div>

      {/* Danh sách các hồ sơ PO sẵn sàng xuất file */}
      <div className="content-card">
        <div className="card-header-flex">
          <div>
            <h2 className="card-title">Danh sách hồ sơ sẵn sàng xuất Excel ({pos.length} hồ sơ)</h2>
            <p className="card-desc">Nhấn vào nút để xuất duy nhất 01 file Excel gồm 02 sheet (Phiếu trình + Bảng kê) cho hồ sơ tương ứng</p>
          </div>
          <div className="flex-align gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportCSV}
            >
              <FileDown size={15} />
              Xuất CSV tổng hợp
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => storageService.exportBackup()}
            >
              <Database size={15} />
              Sao lưu dữ liệu (JSON)
            </button>
          </div>
        </div>

        {pos.length === 0 ? (
          <div className="empty-state-box">
            <Layers size={48} className="text-muted" />
            <p>Chưa có hồ sơ PO nào trong hệ thống.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="procurement-table">
              <thead>
                <tr>
                  <th>Mã PO</th>
                  <th>Ngày lập</th>
                  <th>Người đề xuất</th>
                  <th>Số sản phẩm</th>
                  <th>Tổng giá trị chưa VAT</th>
                  <th>Trạng thái</th>
                  <th>Tải 01 File Excel (02 Sheet)</th>
                </tr>
              </thead>
              <tbody>
                {pos.map(po => {
                  const poTotal = (po.items || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
                  return (
                    <tr key={po.id}>
                      <td className="font-mono font-bold text-navy">{po.po}</td>
                      <td>{formatExcelDate(po.date)}</td>
                      <td>{po.requester || '—'}</td>
                      <td className="text-center font-medium">{po.items?.length || 0}</td>
                      <td className="font-bold">{formatCurrency(poTotal)}</td>
                      <td>
                        <StatusBadge status={po.status} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-download-duo"
                          onClick={() => onExportPO(po.id)}
                          disabled={isExporting}
                          title="Tải về duy nhất 01 file: Sheet 1 - Phiếu trình & Sheet 2 - Bảng kê"
                        >
                          <Download size={15} />
                          {isExporting ? 'Đang xuất...' : 'Tải 01 File Excel'}
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
