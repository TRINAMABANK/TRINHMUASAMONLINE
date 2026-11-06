import React, { useState, useMemo } from 'react';
import { EditableCell } from './EditableCell.jsx';
import { RowSelection } from './RowSelection.jsx';
import { normalizeText } from '../utils/validation.js';
import { formatCurrency } from '../utils/currencyUtils.js';
import {
  Search,
  Filter,
  Copy,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';

export function DataTable({
  rows = [],
  onUpdateCell,
  onDeleteRow,
  onDuplicateRow,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  warnings = []
}) {
  // Bộ lọc tìm kiếm
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');

  // Sắp xếp (sorting)
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  // Phân trang (pagination)
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  // Danh sách các nhà cung cấp & đơn vị để lọc dropdown
  const uniqueSuppliers = useMemo(() => {
    return [...new Set(rows.map(r => (r.supplier || '').trim()).filter(Boolean))].sort();
  }, [rows]);

  const uniqueUnits = useMemo(() => {
    return [...new Set(rows.map(r => (r.unit || '').trim()).filter(Boolean))].sort();
  }, [rows]);

  // Lọc và tìm kiếm
  const filteredRows = useMemo(() => {
    const normSearch = normalizeText(searchTerm);

    return rows.filter(r => {
      // Tìm kiếm toàn văn
      if (normSearch) {
        const fullContent = normalizeText(
          `${r.stt} ${r.unit} ${r.supplier} ${r.item} ${r.spec} ${r.purpose} ${r.msp}`
        );
        if (!fullContent.includes(normSearch)) return false;
      }

      // Lọc NCC
      if (supplierFilter && r.supplier !== supplierFilter) {
        return false;
      }

      // Lọc Đơn vị
      if (unitFilter && r.unit !== unitFilter) {
        return false;
      }

      return true;
    });
  }, [rows, searchTerm, supplierFilter, unitFilter]);

  // Sắp xếp
  const sortedRows = useMemo(() => {
    if (!sortField) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = normalizeText(valA);
      const strB = normalizeText(valB);
      if (sortDirection === 'asc') {
        return strA.localeCompare(strB);
      } else {
        return strB.localeCompare(strA);
      }
    });
  }, [filteredRows, sortField, sortDirection]);

  // Phân trang
  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  // Xử lý click header để sắp xếp
  const handleSort = (field) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null); // Bỏ sắp xếp
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const selectedRows = rows.filter(r => r.selected !== false);
  const selectedCount = selectedRows.length;
  const totalSelectedAmount = selectedRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const totalSelectedQty = selectedRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);

  const isAllPageSelected = paginatedRows.length > 0 && paginatedRows.every(r => r.selected !== false);

  return (
    <div className="datatable-container">
      {/* Cảnh báo nếu có */}
      {warnings.length > 0 && (
        <div className="table-warnings-bar">
          <AlertTriangle size={18} className="warning-icon" />
          <div className="warning-content">
            <b>Cảnh báo dữ liệu ({warnings.length} điểm cần rà soát):</b>{' '}
            {warnings.slice(0, 5).join(' • ')}
            {warnings.length > 5 && ` và ${warnings.length - 5} điểm khác...`}
          </div>
        </div>
      )}

      {/* Thanh tìm kiếm & bộ lọc */}
      <div className="table-filter-bar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Tìm theo nội dung, đơn vị, nhà cung cấp, MSP..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="filter-dropdowns">
          <div className="filter-select-wrapper">
            <Filter size={14} className="filter-icon" />
            <select
              className="filter-select"
              value={supplierFilter}
              onChange={(e) => {
                setSupplierFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Tất cả Nhà cung cấp ({uniqueSuppliers.length})</option>
              {uniqueSuppliers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="filter-select-wrapper">
            <Filter size={14} className="filter-icon" />
            <select
              className="filter-select"
              value={unitFilter}
              onChange={(e) => {
                setUnitFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Tất cả Đơn vị ({uniqueUnits.length})</option>
              {uniqueUnits.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Thanh chọn dòng và thống kê tiền */}
      <RowSelection
        selectedCount={selectedCount}
        totalCount={rows.length}
        totalAmount={totalSelectedAmount}
        totalQty={totalSelectedQty}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
      />

      {/* Bảng dữ liệu chính */}
      <div className="table-responsive">
        <table className="procurement-table">
          <thead>
            <tr>
              <th className="th-checkbox">
                <input
                  type="checkbox"
                  checked={isAllPageSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      paginatedRows.forEach(r => onToggleSelect(r.id, true));
                    } else {
                      paginatedRows.forEach(r => onToggleSelect(r.id, false));
                    }
                  }}
                  title="Chọn tất cả dòng ở trang này"
                />
              </th>
              <th className="th-stt" onClick={() => handleSort('stt')}>
                STT {sortField === 'stt' ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
              </th>
              <th className="th-date" onClick={() => handleSort('date')}>
                Ngày {sortField === 'date' ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
              </th>
              <th className="th-unit" onClick={() => handleSort('unit')}>
                Tên đơn vị {sortField === 'unit' ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
              </th>
              <th className="th-supplier" onClick={() => handleSort('supplier')}>
                Nhà cung cấp {sortField === 'supplier' ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
              </th>
              <th className="th-item" onClick={() => handleSort('item')}>
                Nội dung / Tên hàng hóa <span className="req">*</span> {sortField === 'item' ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
              </th>
              <th className="th-qty" onClick={() => handleSort('qty')}>
                SL <span className="req">*</span> {sortField === 'qty' ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
              </th>
              <th className="th-spec">Quy cách</th>
              <th className="th-price" onClick={() => handleSort('price')}>
                Đơn giá chưa VAT {sortField === 'price' ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
              </th>
              <th className="th-amount" onClick={() => handleSort('amount')}>
                Thành tiền chưa VAT {sortField === 'amount' ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
              </th>
              <th className="th-purpose">Mục đích sử dụng</th>
              <th className="th-actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={12} className="empty-table-cell">
                  Không tìm thấy dòng dữ liệu nào phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, idx) => {
                const isSelected = row.selected !== false;
                return (
                  <tr key={row.id} className={isSelected ? 'row-selected' : 'row-deselected'}>
                    <td className="cell-checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onToggleSelect(row.id, e.target.checked)}
                      />
                    </td>
                    <td className="cell-stt">{row.stt}</td>
                    <td className="cell-date">
                      <EditableCell
                        value={row.date}
                        align="center"
                        onChange={(v) => onUpdateCell(row.id, 'date', v)}
                      />
                    </td>
                    <td className="cell-unit">
                      <EditableCell
                        value={row.unit}
                        onChange={(v) => onUpdateCell(row.id, 'unit', v)}
                      />
                    </td>
                    <td className="cell-supplier">
                      <EditableCell
                        value={row.supplier}
                        onChange={(v) => onUpdateCell(row.id, 'supplier', v)}
                      />
                    </td>
                    <td className="cell-item">
                      <EditableCell
                        value={row.item}
                        className="font-medium"
                        onChange={(v) => onUpdateCell(row.id, 'item', v)}
                      />
                      {row.msp && (
                        <div className="cell-sub-msp">MSP: {row.msp}</div>
                      )}
                    </td>
                    <td className="cell-qty">
                      <EditableCell
                        value={row.qty}
                        type="number"
                        align="center"
                        onChange={(v) => onUpdateCell(row.id, 'qty', v)}
                      />
                    </td>
                    <td className="cell-spec">
                      <EditableCell
                        value={row.spec}
                        align="center"
                        onChange={(v) => onUpdateCell(row.id, 'spec', v)}
                      />
                    </td>
                    <td className="cell-price">
                      <EditableCell
                        value={row.price}
                        type="number"
                        align="right"
                        onChange={(v) => onUpdateCell(row.id, 'price', v)}
                      />
                    </td>
                    <td className="cell-amount font-bold text-navy">
                      <EditableCell
                        value={row.amount}
                        type="number"
                        align="right"
                        onChange={(v) => onUpdateCell(row.id, 'amount', v)}
                      />
                    </td>
                    <td className="cell-purpose">
                      <EditableCell
                        value={row.purpose}
                        onChange={(v) => onUpdateCell(row.id, 'purpose', v)}
                      />
                    </td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => onDuplicateRow(row.id)}
                        title="Sao chép dòng này"
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon btn-icon-danger"
                        onClick={() => onDeleteRow(row.id)}
                        title="Xóa dòng này"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Phân trang */}
      <div className="table-pagination-bar">
        <div className="pagination-info">
          Hiển thị {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, sortedRows.length)} / {sortedRows.length} dòng dữ liệu
        </div>

        <div className="pagination-controls">
          <select
            className="page-size-select"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={10}>10 dòng/trang</option>
            <option value={15}>15 dòng/trang</option>
            <option value={25}>25 dòng/trang</option>
            <option value={50}>50 dòng/trang</option>
            <option value={100}>100 dòng/trang</option>
          </select>

          <button
            type="button"
            className="btn-page-nav"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            <ChevronLeft size={16} />
          </button>

          <span className="page-indicator">
            Trang <b>{currentPage}</b> / {totalPages}
          </span>

          <button
            type="button"
            className="btn-page-nav"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
