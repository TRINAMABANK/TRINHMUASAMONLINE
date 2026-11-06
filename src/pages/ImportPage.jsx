import React, { useState, useEffect } from 'react';
import { UploadExcel } from '../components/UploadExcel.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { POToolbar } from '../components/POToolbar.jsx';
import { useExcelImport } from '../hooks/useExcelImport.js';
import { useRowSelection } from '../hooks/useRowSelection.js';
import { todayYMD } from '../utils/dateUtils.js';

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
    deselectAll
  } = useRowSelection(rows, setRows);

  // Form thông tin PO
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState(todayYMD());
  const [requester, setRequester] = useState('Nguyễn Văn A');
  const [payGroup, setPayGroup] = useState('A');
  const [note, setNote] = useState('');

  // Tự động sinh mã PO khi khởi động hoặc khi nạp file
  useEffect(() => {
    if (!poNumber) {
      setPoNumber(generateNextPO());
    }
  }, [generateNextPO, poNumber]);

  // Xử lý tạo PO và xuất file
  const handleCreateAndExport = async () => {
    if (selectedCount === 0) {
      alert('Vui lòng tick chọn ít nhất 1 dòng trong bảng dữ liệu để xuất hồ sơ.');
      return;
    }

    try {
      await onCreatePO({
        poNumber,
        date: poDate,
        requester,
        payGroup,
        note,
        source: fileName || 'File Excel người dùng tải lên',
        selectedRows
      });

      alert(`Đã tạo thành công hồ sơ ${poNumber} từ ${selectedCount} dòng đã chọn! Trình duyệt đang tải về 2 file Excel.`);
      
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
          <h1 className="page-title">Quy trình Nhập Phiếu Thô & Xuất Bảng Trình Ký</h1>
          <p className="page-subtitle">
            Upload file Excel &rarr; Đọc tự động &rarr; Chỉnh sửa trực tiếp &rarr; Tick chọn &rarr; Xuất 2 file Excel
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

      {/* Bước 2 & 3: Hiển thị Bảng Dữ Liệu & Toolbar tạo PO khi đã có dữ liệu */}
      {rows.length > 0 && (
        <div className="import-content-group">
          {/* Toolbar thiết lập mã PO & xuất 2 file */}
          <POToolbar
            poNumber={poNumber}
            onPoChange={setPoNumber}
            date={poDate}
            onDateChange={setPoDate}
            requester={requester}
            onRequesterChange={setRequester}
            payGroup={payGroup}
            onPayGroupChange={setPayGroup}
            note={note}
            onNoteChange={setNote}
            selectedCount={selectedCount}
            canUndo={canUndo}
            onUndo={undo}
            onAddRow={addRow}
            onCreatePO={handleCreateAndExport}
            isExporting={isExporting}
          />

          {/* Bảng dữ liệu tương tác đầy đủ */}
          <div className="content-card">
            <div className="card-header-flex">
              <div>
                <h2 className="card-title">Dữ liệu chi tiết từng dòng ({rows.length} dòng)</h2>
                <p className="card-desc">
                  Nhấp vào bất kỳ ô nào để chỉnh sửa trực tiếp. Tick chọn các dòng cần đưa vào hồ sơ trình ký.
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
        </div>
      )}
    </div>
  );
}
