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
    toggleRowsBatch,
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

  // Xử lý ACCEPT – XÁC NHẬN PHÂN LOẠI & XUẤT PHIẾU:
  // 1. Phân loại bù trừ: dòng được tick thuộc nhóm đã chọn, dòng không tick thuộc nhóm còn lại
  // 2. Kiểm tra dữ liệu phân nhóm chặt chẽ (hợp lệ, số dòng, tổng tiền, không thiếu không trùng)
  // 3. Nếu chưa hợp lệ: thông báo lỗi và không xuất phiếu
  // 4. Nếu hợp lệ: lưu kết quả phân nhóm vào PO, xuất phiếu theo quy trình hiện hữu (Excel 01 file 02 sheet)
  // 5. Thông báo hoàn tất và lưu lịch sử thao tác
  const handleAcceptClassification = async (chosenTypeForSelected) => {
    if (isExporting) return false;

    // 1. Kiểm tra điều kiện đầu vào
    const checkedRows = rows.filter(r => r.selected === true);
    if (checkedRows.length === 0) {
      alert('Vui lòng tick chọn ít nhất một dòng hàng hóa trước khi nhấn ACCEPT – XÁC NHẬN PHÂN LOẠI.');
      return false;
    }

    if (!chosenTypeForSelected) {
      alert('Vui lòng chọn loại thanh toán (Hội sở thanh toán hoặc Đơn vị thanh toán) trước khi nhấn ACCEPT.');
      return false;
    }

    const otherType = chosenTypeForSelected === 'HOI_SO' ? 'DON_VI' : 'HOI_SO';
    const targetLabel = chosenTypeForSelected === 'HOI_SO' ? 'Hội sở thanh toán' : 'Đơn vị thanh toán';
    const otherLabel = otherType === 'HOI_SO' ? 'Hội sở thanh toán' : 'Đơn vị thanh toán';

    // 2. Thực hiện tự phân loại bù trừ trên toàn bộ dòng hàng hóa
    const classifiedRows = rows.map(row => {
      const isSelected = row.selected === true;
      return {
        ...row,
        payGroup: isSelected ? chosenTypeForSelected : otherType,
        selected: true // Đưa vào hồ sơ xuất
      };
    });

    // 3. KIỂM TRA DỮ LIỆU PHÂN NHÓM CHẶT CHẼ (VALIDATION)
    // 3.1. Kiểm tra số lượng dòng
    if (classifiedRows.length !== rows.length || rows.length === 0) {
      alert('LỖI DỮ LIỆU: Danh sách hàng hóa rỗng hoặc số dòng không khớp. Không thể xuất phiếu.');
      return false;
    }

    // 3.2. Kiểm tra tính hợp lệ của từng dòng hàng hóa
    const criticalErrors = [];
    classifiedRows.forEach((r, idx) => {
      const stt = r.stt || (idx + 1);
      if (!r.item || String(r.item).trim() === '') {
        criticalErrors.push(`• Dòng ${stt}: Tên hàng hóa không được để trống.`);
      }
      if (isNaN(Number(r.qty)) || Number(r.qty) <= 0) {
        criticalErrors.push(`• Dòng ${stt}: Số lượng (${r.qty}) không hợp lệ (phải là số > 0).`);
      }
      if (isNaN(Number(r.price)) || Number(r.price) < 0) {
        criticalErrors.push(`• Dòng ${stt}: Đơn giá (${r.price}) không hợp lệ (phải >= 0).`);
      }
      if (isNaN(Number(r.amount)) || Number(r.amount) < 0) {
        criticalErrors.push(`• Dòng ${stt}: Thành tiền (${r.amount}) không hợp lệ.`);
      }
    });

    if (criticalErrors.length > 0) {
      alert(
        `DỮ LIỆU HÀNG HÓA CHƯA HỢP LỆ (KHÔNG THỂ XUẤT PHIẾU):\n\n` +
        criticalErrors.slice(0, 5).join('\n') +
        (criticalErrors.length > 5 ? `\n... và ${criticalErrors.length - 5} dòng lỗi khác.` : '') +
        `\n\nVui lòng chỉnh sửa lại dữ liệu trong bảng trước khi nhấn ACCEPT.`
      );
      return false;
    }

    // 3.3. Kiểm tra phân nhóm và đối chiếu số dòng, tổng tiền
    const itemsHO = classifiedRows.filter(r => r.payGroup === 'HOI_SO' || r.payGroup === 'A');
    const itemsDV = classifiedRows.filter(r => r.payGroup === 'DON_VI' || r.payGroup === 'B');
    const totalAmountHO = itemsHO.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalAmountDV = itemsDV.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalClassified = totalAmountHO + totalAmountDV;
    const grandTotal = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    // Kiểm tra không thiếu hoặc trùng hàng hóa
    if (itemsHO.length + itemsDV.length !== rows.length) {
      alert(
        `LỖI PHÂN LOẠI:\n\n` +
        `Tổng số dòng hai nhóm sau phân loại (${itemsHO.length + itemsDV.length}) không khớp với tổng số dòng của bảng (${rows.length}). Phát hiện dòng bị thiếu hoặc trùng lặp.`
      );
      return false;
    }

    // Kiểm tra tổng tiền
    if (Math.abs(totalClassified - grandTotal) > 0.01) {
      alert(
        `LỖI TỔNG TIỀN:\n\n` +
        `Tổng tiền hai nhóm sau phân loại (${formatCurrency(totalClassified)}) không khớp với tổng tiền danh sách hàng hóa (${formatCurrency(grandTotal)}).\n` +
        `Chênh lệch: ${formatCurrency(Math.abs(totalClassified - grandTotal))}.\n\n` +
        `Vui lòng kiểm tra lại đơn giá và thành tiền của các mặt hàng.`
      );
      return false;
    }

    // 4. THỰC HIỆN LƯU VÀO PO VÀ XUẤT PHIẾU THEO ĐÚNG QUY TRÌNH HIỆN HỮU
    try {
      // Cập nhật trạng thái rows trên UI (bỏ chọn tick)
      setRows(classifiedRows.map(r => ({ ...r, selected: false })));

      const finalPONumber = poNumber || generateNextPO();
      const logText = `ADMIN thực hiện ACCEPT – XÁC NHẬN PHÂN LOẠI: Đã phân loại thành công ${itemsHO.length} dòng Hội sở thanh toán (${formatCurrency(totalAmountHO)}) và ${itemsDV.length} dòng Đơn vị thanh toán (${formatCurrency(totalAmountDV)}). Tự động lưu PO và xuất phiếu trình (01 file Excel gồm 02 Sheet).`;

      const createdPO = await onCreatePO({
        poNumber: finalPONumber,
        date: poDate,
        requester,
        note,
        source: fileName || 'File Excel nhập khẩu',
        selectedRows: classifiedRows,
        customLog: logText
      });

      // 5. THÔNG BÁO HOÀN TẤT VÀ LƯU LỊCH SỬ THAO TÁC
      alert(
        `ĐÃ XÁC NHẬN PHÂN LOẠI & XUẤT PHIẾU THÀNH CÔNG!\n\n` +
        `• Mã hồ sơ PO: ${createdPO?.po || finalPONumber}\n` +
        `• Nhóm Hội sở thanh toán: ${itemsHO.length} dòng (${formatCurrency(totalAmountHO)})\n` +
        `• Nhóm Đơn vị thanh toán: ${itemsDV.length} dòng (${formatCurrency(totalAmountDV)})\n` +
        `• Tổng cộng toàn bộ hồ sơ: ${classifiedRows.length} dòng (${formatCurrency(totalClassified)})\n\n` +
        `✓ Đã lưu kết quả phân nhóm vào hồ sơ PO và ghi nhận lịch sử thao tác.\n` +
        `✓ File Excel duy nhất gồm đúng 02 Sheet (Sheet 1: PHIẾU TRÌNH, Sheet 2: BẢNG KÊ) đang được tải về trình duyệt.`
      );

      // Chuyển sang màn hình quản lý hồ sơ PO
      onNavigate('pos');
      return true;
    } catch (err) {
      alert(`Lỗi khi lưu PO và xuất phiếu: ${err.message}`);
      return false;
    }
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
              onToggleBatch={toggleRowsBatch}
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
            isExporting={isExporting}
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
