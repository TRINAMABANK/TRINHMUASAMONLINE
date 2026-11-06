import ExcelJS from 'exceljs';
import { TEMPLATE_CONFIG } from './templateMapper.js';
import { formatCurrency, formatNumber } from '../utils/currencyUtils.js';

/**
 * Tải file mẫu dưới dạng ArrayBuffer
 * @param {string} templatePath Đường dẫn tương đối từ thư mục public (ví dụ /templates/1_BANG_TRINH_KY.xlsx)
 * @param {ArrayBuffer} [overrideBuffer] Buffer truyền sẵn (dành cho môi trường node/test)
 */
async function loadTemplateBuffer(templatePath, overrideBuffer = null) {
  if (overrideBuffer) {
    return overrideBuffer;
  }
  
  if (typeof fetch !== 'undefined') {
    const res = await fetch(templatePath);
    if (!res.ok) {
      throw new Error(`Không thể tải template tại đường dẫn ${templatePath} (Mã lỗi: ${res.status})`);
    }
    return await res.arrayBuffer();
  }

  throw new Error('Môi trường không hỗ trợ fetch template. Vui lòng cung cấp overrideBuffer.');
}

/**
 * Tải file về máy người dùng trong browser
 * @param {ArrayBuffer|Blob} buffer 
 * @param {string} filename 
 */
export function triggerFileDownload(buffer, filename) {
  const blob = buffer instanceof Blob ? buffer : new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Service xuất 2 file Excel theo đúng 2 mẫu có sẵn:
 * 1. BẢNG TRÌNH KÝ (1_BANG_TRINH_KY.xlsx)
 * 2. BẢNG KÊ (2_BANG_KE.xlsx)
 */
export const excelExporter = {
  /**
   * Tạo workbook BẢNG TRÌNH KÝ từ template 1
   * @param {object} poData Dữ liệu hồ sơ PO
   * @param {ArrayBuffer} [customTemplateBuffer]
   * @returns {Promise<ExcelJS.Workbook>}
   */
  async generateBangTrinhKy(poData, customTemplateBuffer = null) {
    const cfg = TEMPLATE_CONFIG.TRINH_KY;
    const arrayBuffer = await loadTemplateBuffer('/templates/1_BANG_TRINH_KY.xlsx', customTemplateBuffer);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[cfg.sheetIndex] || workbook.worksheets[0];
    if (!worksheet) throw new Error('Không tìm thấy sheet Bảng trình ký trong file mẫu.');

    // Tính toán ngày tháng
    const dateObj = poData.date ? new Date(poData.date) : new Date();
    const day = isNaN(dateObj.getDate()) ? new Date().getDate() : dateObj.getDate();
    const month = isNaN(dateObj.getMonth()) ? new Date().getMonth() + 1 : dateObj.getMonth() + 1;
    const year = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();

    // Điền ngày tháng vào ô F5 (nằm trong ô gộp F5:H5)
    worksheet.getCell(cfg.cells.dateCell).value = `Tp. Hồ Chí Minh, ngày ${day} tháng ${month} năm ${year}`;

    // Tổng số lượng & tổng thành tiền
    const items = (poData.items || []).filter(x => x.selected !== false);
    const totalQty = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    // Gom danh sách nhà cung cấp không trùng lặp
    const suppliers = [...new Set(items.map(x => (x.supplier || '').trim()).filter(Boolean))].join(', ') || '-';

    // Gom mục đích sử dụng tóm tắt
    const purposes = [...new Set(items.map(x => (x.purpose || '').trim()).filter(Boolean))].join('; ') 
      || 'Theo đề xuất của đơn vị phục vụ hoạt động chuyên môn';

    const rIdx = cfg.cells.summaryRowIndex; // Row 11
    worksheet.getCell(`${cfg.cells.colSTT}${rIdx}`).value = 1;
    worksheet.getCell(`${cfg.cells.colItem}${rIdx}`).value = 
      `Các tài sản cố định/Công cụ lao động theo bảng kê số: ${poData.po} (Đính kèm bảng kê chi tiết)`;
    worksheet.getCell(`${cfg.cells.colSpec}${rIdx}`).value = '-';
    worksheet.getCell(`${cfg.cells.colPrice}${rIdx}`).value = '-';
    worksheet.getCell(`${cfg.cells.colQty}${rIdx}`).value = totalQty > 0 ? totalQty : '-';
    
    // Thành tiền chưa VAT
    const cellAmount = worksheet.getCell(`${cfg.cells.colAmount}${rIdx}`);
    cellAmount.value = totalAmount;
    cellAmount.numFmt = '#,##0';

    worksheet.getCell(`${cfg.cells.colSupplier}${rIdx}`).value = suppliers;
    worksheet.getCell(`${cfg.cells.colPurpose}${rIdx}`).value = purposes;

    // Chiều cao dòng tóm tắt đảm bảo không bị cắt chữ
    worksheet.getRow(rIdx).height = cfg.rowHeight;

    return workbook;
  },

  /**
   * Tạo workbook BẢNG KÊ từ template 2
   * Xử lý chính xác từng dòng, điều chỉnh ô gộp và vùng chữ ký không bị vỡ hay dịch chuyển sai
   * @param {object} poData 
   * @param {ArrayBuffer} [customTemplateBuffer]
   * @returns {Promise<ExcelJS.Workbook>}
   */
  async generateBangKe(poData, customTemplateBuffer = null) {
    const cfg = TEMPLATE_CONFIG.BANG_KE;
    const arrayBuffer = await loadTemplateBuffer('/templates/2_BANG_KE.xlsx', customTemplateBuffer);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[cfg.sheetIndex] || workbook.worksheets[0];
    if (!worksheet) throw new Error('Không tìm thấy sheet Bảng kê trong file mẫu.');

    // 1. Điền thông tin tiêu đề: Mã PO (A4) và Ngày tháng (J4)
    worksheet.getCell(cfg.cells.poCodeCell).value = poData.po;

    const dateObj = poData.date ? new Date(poData.date) : new Date();
    const day = isNaN(dateObj.getDate()) ? new Date().getDate() : dateObj.getDate();
    const month = isNaN(dateObj.getMonth()) ? new Date().getMonth() + 1 : dateObj.getMonth() + 1;
    const year = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();
    worksheet.getCell(cfg.cells.dateCell).value = `Tp.HCM, Ngày ${day} tháng ${month} năm ${year}`;

    // 2. Lấy danh sách sản phẩm được tick chọn
    const items = (poData.items || []).filter(x => x.selected !== false);
    const N = items.length;
    if (N === 0) {
      throw new Error('Hồ sơ không có dòng sản phẩm nào được chọn để xuất bảng kê.');
    }

    // 3. Xử lý nhóm A (Row 9 đến 14 trong template gốc, tổng cộng 6 dòng có sẵn)
    const firstDataRow = cfg.groupA.firstDataRow; // 9
    const origRowCount = cfg.groupA.templateRowCount; // 6
    const delta = N - origRowCount; // Số dòng chênh lệch (dương nếu thêm, âm nếu bớt)

    // Đọc và sao lưu danh sách merged cells hiện có trong worksheet
    const originalMerges = [...(worksheet.model.merges || [])];

    // Gỡ toàn bộ merged cells tạm thời để thao tác chèn/xóa dòng an toàn không xung đột
    originalMerges.forEach(mergeRange => {
      try {
        worksheet.unMergeCells(mergeRange);
      } catch (e) {
        // bỏ qua nếu đã unmerge
      }
    });

    // Nếu N > origRowCount (cần thêm dòng): chèn delta dòng tại sau dòng dữ liệu mẫu cuối cùng của nhóm A
    if (delta > 0) {
      const insertAt = firstDataRow + origRowCount; // Row 15 (ngay trước B. ĐƠN VỊ THANH TOÁN)
      // Chèn delta dòng trống
      worksheet.spliceRows(insertAt, 0, ...Array.from({ length: delta }, () => Array(10).fill(null)));
    } else if (delta < 0) {
      // Nếu N < origRowCount (ít dòng hơn mẫu): xóa bớt (origRowCount - N) dòng thừa
      const deleteCount = origRowCount - N;
      const deleteAt = firstDataRow + N; // Xóa từ sau dòng dữ liệu cuối cùng của danh sách
      worksheet.spliceRows(deleteAt, deleteCount);
    }

    // Hàm điều chỉnh số dòng cho các merged cell nằm sau nhóm dữ liệu A (từ dòng 15 trở đi)
    const shiftRowNumber = (rowNum) => {
      // Nếu dòng nằm trước hoặc trong vùng nhóm A (<= 14 khi chưa sửa), không đổi nếu trước điểm chèn/xóa
      const cutoff = firstDataRow + (delta > 0 ? origRowCount : N);
      if (rowNum >= cutoff) {
        return rowNum + delta;
      }
      return rowNum;
    };

    // Khôi phục lại các merged cells với tọa độ đã được điều chỉnh chuẩn xác
    originalMerges.forEach(rangeStr => {
      const match = rangeStr.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (!match) return;

      const colStart = match[1];
      const rowStart = Number(match[2]);
      const colEnd = match[3];
      const rowEnd = Number(match[4]);

      const newRowStart = shiftRowNumber(rowStart);
      const newRowEnd = shiftRowNumber(rowEnd);

      try {
        worksheet.mergeCells(`${colStart}${newRowStart}:${colEnd}${newRowEnd}`);
      } catch (err) {
        console.warn(`Không thể khôi phục merge ${colStart}${newRowStart}:${colEnd}${newRowEnd}:`, err);
      }
    });

    // 4. Lấy dòng mẫu chuẩn (dòng 9) để sao chép format cho toàn bộ các dòng dữ liệu
    const sampleRow = worksheet.getRow(firstDataRow);

    // Điền dữ liệu N dòng sản phẩm
    let totalCalculatedAmount = 0;

    items.forEach((item, idx) => {
      const currentRowNumber = firstDataRow + idx;
      const targetRow = worksheet.getRow(currentRowNumber);

      const qtyNum = Number(item.qty) || 0;
      const priceNum = Number(item.price) || 0;
      const amountNum = (Number(item.amount) || 0) || (qtyNum * priceNum);
      totalCalculatedAmount += amountNum;

      // Các giá trị 10 cột
      const rowValues = [
        idx + 1,                         // Col 1 (A): STT
        item.date || '',                 // Col 2 (B): Ngày đề xuất
        item.unit || '',                 // Col 3 (C): Tên đơn vị
        item.supplier || '',             // Col 4 (D): Nhà cung cấp
        item.item || '',                 // Col 5 (E): Nội dung
        qtyNum,                          // Col 6 (F): SL
        item.spec || '',                 // Col 7 (G): Quy cách
        priceNum,                        // Col 8 (H): Đơn giá chưa VAT
        amountNum,                       // Col 9 (I): Thành tiền chưa VAT
        item.purpose || ''               // Col 10 (J): Mục đích sử dụng
      ];

      for (let c = 1; c <= 10; c++) {
        const cell = targetRow.getCell(c);
        const sampleCell = sampleRow.getCell(c);

        cell.value = rowValues[c - 1];

        // Kế thừa style (font, border, fill) từ mẫu
        if (sampleCell.style) {
          cell.style = JSON.parse(JSON.stringify(sampleCell.style));
        }

        // Căn chỉnh nội dung & tự động xuống dòng (wrapText)
        cell.alignment = {
          ...(cell.alignment || {}),
          vertical: 'middle',
          wrapText: true
        };

        // Căn lề và định dạng số chuyên nghiệp
        if (c === 1 || c === 2 || c === 6 || c === 7) {
          // STT, Ngày, SL, Quy cách căn giữa
          cell.alignment.horizontal = 'center';
        } else if (c === 8 || c === 9) {
          // Đơn giá, Thành tiền căn phải
          cell.alignment.horizontal = 'right';
        } else {
          // Văn bản căn trái
          cell.alignment.horizontal = 'left';
        }

        // Định dạng số cho SL, Đơn giá, Thành tiền
        if ([6, 8, 9].includes(c)) {
          cell.numFmt = '#,##0';
        }
      }

      // Đặt chiều cao dòng dữ liệu
      targetRow.height = cfg.dataRowHeight;
    });

    // 5. Cập nhật dòng TỔNG CỘNG CHƯA BAO GỒM VAT
    const finalTotalRowNumber = cfg.originalTotalRow + delta;
    const totalRow = worksheet.getRow(finalTotalRowNumber);

    // Ô A (nằm trong merged A:H)
    totalRow.getCell(1).value = 'TỔNG CỘNG CHƯA BAO GỒM VAT:';

    // Ô I: Thành tiền tổng cộng
    const totalAmountCell = totalRow.getCell(9);
    totalAmountCell.value = totalCalculatedAmount;
    totalAmountCell.numFmt = '#,##0';
    totalAmountCell.font = { ...(totalAmountCell.font || {}), bold: true, size: 10 };
    totalAmountCell.alignment = {
      ...(totalAmountCell.alignment || {}),
      horizontal: 'right',
      vertical: 'middle'
    };

    return workbook;
  },

  /**
   * Xuất cả 2 file Excel và tự động kích hoạt tải xuống trình duyệt
   * @param {object} poData 
   */
  async exportBothExcelFiles(poData) {
    const wb1 = await this.generateBangTrinhKy(poData);
    const wb2 = await this.generateBangKe(poData);

    const buf1 = await wb1.xlsx.writeBuffer();
    const buf2 = await wb2.xlsx.writeBuffer();

    const cleanPO = (poData.po || 'PO').replace(/[/\\?%*:|"<>]/g, '_');
    
    // Tải file 1: BẢNG TRÌNH KÝ
    triggerFileDownload(buf1, `${cleanPO}_01_Bang_trinh_ky.xlsx`);

    // Tải file 2: BẢNG KÊ (delay 500ms để trình duyệt tải tuần tự không chặn popup)
    setTimeout(() => {
      triggerFileDownload(buf2, `${cleanPO}_02_Bang_ke.xlsx`);
    }, 600);

    return { success: true, po: poData.po };
  }
};
