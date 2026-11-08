import React, { useState, useEffect } from 'react';
import { UploadExcel } from '../components/UploadExcel.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { POToolbar } from '../components/POToolbar.jsx';
import { BatchActionToolbar } from '../components/BatchActionToolbar.jsx';
import { GroupSummaryCards } from '../components/GroupSummaryCards.jsx';
import { ExportConfirmationBar } from '../components/ExportConfirmationBar.jsx';
import { useExcelImport } from '../hooks/useExcelImport.js';
import { useRowSelection } from '../hooks/useRowSelection.js';
import { todayYMD } from '../utils/dateUtils.js';
import { formatCurrency } from '../utils/currencyUtils.js';

export function ImportPage({ onCreatePO, isExporting, generateNextPO, onNavigate }) {
  const {
    fileName,
    rows,
    headers,
    isLoading,
    error,
    warnings,
    canUndo,
    handleFileImport,
    setRows,
    updateCell,
    addRow,
    deleteRow,
    duplicateRow,
    classifyRows,
    unclassifyRows,
    unclassifyGroup,
    undo,
    clearData
  } = useExcelImport();

  const {
    selectedRows,
    selectedCount,
    selectedTotalAmount,
    selectedTotalQty,
    toggleRow,
    selectAll,
    selectAllUnassigned,
    deselectAll
  } = useRowSelection(rows, setRows);

  // Form thông tin PO
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState(todayYMD());
  const [requester, setRequester] = useState('Nguyễn Văn A');
  const [note, setNote] = useState('');

  // Bộ lọc nhóm thanh toán hiển thị bảng: '' (tất cả) | 'UNASSIGNED' | 'HOI_SO' | 'DON_VI'
  const [groupFilter, setGroupFilter] = useState('');

  // Tự động sinh mã PO khi khởi động hoặc khi nạp file
  useEffect(() => {
    if (!poNumber) {
      setPoNumber(generateNextPO());
    }
  }, [generateNextPO, poNumber]);

  // Thống kê phân loại hồ sơ
  const itemsHO = rows.filter(r => r.payGroup === 'HOI_SO' || r.payGroup === 'A');
  const countHO = itemsHO.length;
  const amountHO = itemsHO.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const itemsDV = rows.filter(r => r.payGroup === 'DON_VI' || r.payGroup === 'B');
  const countDV = itemsDV.length;
  const amountDV = itemsDV.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const itemsUnassigned = rows.filter(r => !r.payGroup);
  const countUnassigned = itemsUnassigned.length;
  const amountUnassigned = itemsUnassigned.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const classifiedCount = countHO + countDV;
  const totalClassifiedAmount = amountHO + amountDV;
  const grandTotalAmount = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  // Xử lý ACCEPT phân loại bù trừ:
  // Phần nào tick chọn Hội sở thanh toán thì phần còn lại là Đơn vị thanh toán và ngược lại
  const handleAcceptClassification = (chosenTypeForSelected) => {
    const otherType = chosenTypeForSelected === 'HOI_SO' ? 'DON_VI' : 'HOI_SO';

    setRows(prevRows => {
      return prevRows.map(row => {
        if (row.selected === true) {
          return {
            ...row,
            payGroup: chosenTypeForSelected,
            selected: false
          };
        } else {
          return {
            ...row,
            payGroup: otherType,
            selected: false
          };
        }
      });
    });
    return true;
  };

  // Hủy toàn bộ phân loại của hồ sơ
  const handleUnclassifyAll = () => {
    setRows(prevRows => {
      return prevRows.map(row => ({
        ...row,
        payGroup: null
      }));
    });
  };

  // Hủy phân loại cả nhóm (HOI_SO hoặc DON_VI)
  const handleUnclassifyGroup = (groupType) => {
    unclassifyGroup(groupType);
  };

  // Xử lý tạo PO và xuất 01 file Excel (gồm 02 Sheet)
  const handleCreateAndExport = async () => {
    // 1. Kiểm tra điều kiện: Chưa phân loại dòng nào hoặc còn dòng chưa phân loại
    if (countUnassigned > 0 || classifiedCount < rows.length) {
      alert(
        `CHƯA THỂ XUẤT HỒ SƠ:\n\n` +
        `• Đã phân loại: ${classifiedCount} / ${rows.length} dòng\n` +
        `• Còn thiếu: ${countUnassigned} dòng chưa phân loại Nhóm TT (${formatCurrency(amountUnassigned)})\n\n` +
        `Yêu cầu: Tất cả các dòng hàng hóa phải được phân loại đầy đủ 100% vào Hội sở hoặc Đơn vị thanh toán trước khi xuất file.`
      );
      return;
    }

    // 2. Kiểm tra lỗi dữ liệu nghiêm trọng
    const hasCriticalErrors = rows.some(r => {
      const itemEmpty = !r.item || String(r.item).trim() === '';
      const qtyInvalid = isNaN(Number(r.qty)) || Number(r.qty) <= 0;
      const priceInvalid = isNaN(Number(r.price)) || Number(r.price) < 0;
      const amountInvalid = isNaN(Number(r.amount)) || Number(r.amount) < 0;
      return itemEmpty || qtyInvalid || priceInvalid || amountInvalid;
    });

    if (hasCriticalErrors) {
      alert('Dữ liệu hàng hóa có dòng bị lỗi (tên hàng rỗng hoặc số lượng/đơn giá không hợp lệ). Vui lòng kiểm tra lại bảng dữ liệu trước khi xuất.');
      return;
    }

    // 3. Kiểm tra tổng tiền hai nhóm có khớp tổng tiền danh sách được xuất không
    if (Math.abs(totalClassifiedAmount - grandTotalAmount) > 0.01) {
      alert(`Tổng tiền hai nhóm (${formatCurrency(totalClassifiedAmount)}) không khớp tổng tiền danh sách (${formatCurrency(grandTotalAmount)}). Vui lòng kiểm tra lại.`);
      return;
    }

    // 4. Hộp thoại xác nhận xuất 01 file Excel (02 Sheet)
    const ok = window.confirm(
      `XÁC NHẬN VÀ TẢI 01 FILE EXCEL (02 SHEET):\n\n` +
      `• Nhóm Hội sở thanh toán: ${countHO} dòng (${formatCurrency(amountHO)})\n` +
      `• Nhóm Đơn vị thanh toán: ${countDV} dòng (${formatCurrency(amountDV)})\n` +
      `• Tổng cộng hồ sơ: ${classifiedCount} dòng (${formatCurrency(totalClassifiedAmount)})\n\n` +
      `File Excel gồm đúng 02 Sheet:\n` +
      `  1. PHIẾU TRÌNH (Phần Hội sở thanh toán & Phần Đơn vị thanh toán)\n` +
      `  2. BẢNG KÊ (Danh mục hàng hóa 10 cột liền mạch)\n\n` +
      `Bạn có chắc chắn muốn xuất file ngay bây giờ?`
    );
    if (!ok) return;

    try {
      // Đưa toàn bộ các dòng hàng hóa đã phân loại vào hồ sơ xuất
      const exportItems = rows.map(r => ({ ...r, selected: true }));

      await onCreatePO({
        poNumber,
        date: poDate,
        requester,
        note,
        source: fileName || 'File Excel người dùng tải lên',
        selectedRows: exportItems
      });

      alert(
        `ĐÃ XUẤT THÀNH CÔNG HỒ SƠ ${poNumber}!\n\n` +
        `• Đã gộp thành công ${classifiedCount} dòng (${countHO} dòng Hội sở, ${countDV} dòng Đơn vị).\n` +
        `• File Excel gồm đúng 02 Sheet (Sheet 1: PHIẾU TRÌNH, Sheet 2: BẢNG KÊ) đang được tải về.`
      );

      // Chuyển sang màn hình quản lý hồ sơ
      onNavigate('pos');
    } catch (err) {
      alert(`Lỗi tạo hồ sơ: ${err.message}`);
    }
  };

  // Nạp nhanh file phiếu thô thử nghiệm từ public hoặc server
  const handleLoadSample = async () => {
    try {
      const res = await fetch('/test_files/PHIEU_THO.xlsx');
      if (!res.ok) throw new Error('Không thể tải file mẫu');
      const blob = await res.blob();
      const file = new File([blob], 'PHIEU_THO.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      await handleFileImport(file);
    } catch (e) {
      alert('Chưa có file mẫu sẵn trên máy chủ: ' + e.message);
    }
  };

  return (
    <div className="page-container import-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quy trình Nhập Phiếu Thô & Xuất Hồ Sơ Mua Sắm</h1>
          <p className="page-subtitle">
            Upload file Excel &rarr; Tick nhiều dòng &rarr; Chọn loại thanh toán &rarr; <b>ACCEPT một lần</b> &rarr; Xuất duy nhất 01 File Excel (02 Sheet)
          </p>
        </div>
      </div>

      {/* Bước 1: Upload Excel */}
      <UploadExcel
        fileName={fileName}
        isLoading={isLoading}
        error={error}
        validCount={rows.length}
        onFileSelect={handleFileImport}
        onClear={clearData}
        onLoadSample={handleLoadSample}
      />

      {/* Khi đã có dữ liệu */}
      {rows.length > 0 && (
        <div className="import-content-group">
          {/* Thiết lập thông tin PO */}
          <POToolbar
            poNumber={poNumber}
            onPoChange={setPoNumber}
            date={poDate}
            onDateChange={setPoDate}
            requester={requester}
            onRequesterChange={setRequester}
            note={note}
            onNoteChange={setNote}
            countHO={countHO}
            amountHO={amountHO}
            countDV={countDV}
            amountDV={amountDV}
            canUndo={canUndo}
            onUndo={undo}
            onAddRow={addRow}
          />

          {/* Bước 2: Danh sách hàng hóa & Khu vực chọn hàng hóa */}
          <div className="content-card">
            <div className="card-header-flex">
              <div>
                <h2 className="card-title">Danh sách hàng hóa ({rows.length} dòng)</h2>
                <p className="card-desc">
                  Tick chọn các ô bên trái để chọn dòng &rarr; Sử dụng thanh công cụ bên dưới để chọn loại thanh toán và nhấn <b>ACCEPT</b>.
                </p>
              </div>
            </div>

            <DataTable
              rows={rows}
              onUpdateCell={updateCell}
              onDeleteRow={deleteRow}
              onDuplicateRow={duplicateRow}
              onToggleSelect={toggleRow}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              warnings={warnings}
            />
          </div>

          {/* Bước 3 & Bước 4: Khu vực phân loại Nhóm TT & Thao tác ACCEPT */}
          <BatchActionToolbar
            selectedCount={selectedCount}
            selectedTotalAmount={selectedTotalAmount}
            totalCount={rows.length}
            totalAmount={grandTotalAmount}
            classifiedCount={classifiedCount}
            onAcceptClassification={handleAcceptClassification}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onUnclassifyAll={handleUnclassifyAll}
          />

          {/* Bước 5: Bảng tổng hợp Hội sở và Đơn vị thanh toán */}
          <GroupSummaryCards
            rows={rows}
            activeFilter={groupFilter}
            onFilterChange={setGroupFilter}
            onUnclassifyGroup={handleUnclassifyGroup}
          />

          {/* Bước 6 & Bước 7: CUỐI CÙNG CỦA TRANG - Thanh / Khu vực xác nhận & Nút xuất 01 File Excel */}
          <ExportConfirmationBar
            rows={rows}
            classifiedCount={classifiedCount}
            countHO={countHO}
            amountHO={amountHO}
            countDV={countDV}
            amountDV={amountDV}
            countUnassigned={countUnassigned}
            amountUnassigned={amountUnassigned}
            totalClassifiedAmount={totalClassifiedAmount}
            grandTotalAmount={grandTotalAmount}
            isExporting={isExporting}
            onExport={handleCreateAndExport}
          />
        </div>
      )}
    </div>
  );
}
