import ExcelJS from 'exceljs';
import { TEMPLATE_CONFIG } from './templateMapper.js';

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
 * Kích hoạt tải về duy nhất 01 file Excel trên trình duyệt
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
 * Phân loại các sản phẩm được chọn thành 2 nhóm:
 * - Nhóm A: Hội sở thanh toán
 * - Nhóm B: Đơn vị thanh toán
 * @param {Array} items 
 * @returns {{ itemsA: Array, itemsB: Array }}
 */
export function categorizePayGroups(items = []) {
  const selected = items.filter(x => x.selected !== false);
  const itemsA = [];
  const itemsB = [];

  selected.forEach(item => {
    // Nếu có trường payGroup cụ thể
    const pg = String(item.payGroup || '').trim().toUpperCase();
    if (pg === 'A' || pg === 'HO' || pg === 'HOI SO') {
      itemsA.push(item);
    } else if (pg === 'B' || pg === 'DV' || pg === 'DON VI') {
      itemsB.push(item);
    } else {
      // Tự động nhận diện theo tên đơn vị
      const unit = String(item.unit || '').toLowerCase();
      if (unit.includes('hội sở') || unit.includes('hoi so') || unit.includes('khối') || unit.includes('ban') || unit.includes('trung tâm')) {
        itemsA.push(item);
      } else {
        itemsB.push(item);
      }
    }
  });

  return { itemsA, itemsB, allSelected: selected };
}

/**
 * Service xuất duy nhất 01 FILE EXCEL gồm đúng 02 SHEET:
 * SHEET 1: PHIẾU TRÌNH
 * SHEET 2: BẢNG KÊ
 */
export const excelExporter = {
  /**
   * Tạo DUY NHẤT 1 WORKBOOK chứa cả 2 SHEET: PHIẾU TRÌNH & BẢNG KÊ
   * @param {object} poData Dữ liệu hồ sơ PO
   * @param {ArrayBuffer} [customTplBuf1] Buffer template 1 (Bảng trình ký)
   * @param {ArrayBuffer} [customTplBuf2] Buffer template 2 (Bảng kê)
   * @returns {Promise<ExcelJS.Workbook>}
   */
  async generateSingleProcurementWorkbook(poData, customTplBuf1 = null, customTplBuf2 = null) {
    let buf1 = customTplBuf1;
    let buf2 = customTplBuf2;
    if (customTplBuf1 && typeof customTplBuf1 === 'object' && !(customTplBuf1 instanceof ArrayBuffer) && !(customTplBuf1 instanceof Uint8Array)) {
      buf1 = customTplBuf1.customTemplateBuffer1 || customTplBuf1.tplBuf1;
      buf2 = customTplBuf1.customTemplateBuffer2 || customTplBuf1.tplBuf2;
    }

    const tplBuf1 = await loadTemplateBuffer('/templates/1_BANG_TRINH_KY.xlsx', buf1);
    const tplBuf2 = await loadTemplateBuffer('/templates/2_BANG_KE.xlsx', buf2);

    // 1. Phân loại sản phẩm thành 2 nhóm: A. Hội sở thanh toán & B. Đơn vị thanh toán
    const { itemsA, itemsB, allSelected } = categorizePayGroups(poData.items);
    if (allSelected.length === 0) {
      throw new Error('Hồ sơ không có dòng sản phẩm nào được chọn để xuất.');
    }

    // Tính toán số liệu từng nhóm và tổng cộng
    const totalQtyA = itemsA.reduce((s, x) => s + (Number(x.qty) || 0), 0);
    const totalAmountA = itemsA.reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const totalQtyB = itemsB.reduce((s, x) => s + (Number(x.qty) || 0), 0);
    const totalAmountB = itemsB.reduce((s, x) => s + (Number(x.amount) || 0), 0);

    const grandTotalQty = totalQtyA + totalQtyB;
    const grandTotalAmount = totalAmountA + totalAmountB;

    // Ngày tháng định dạng Việt Nam
    const dateObj = poData.date ? new Date(poData.date) : new Date();
    const day = isNaN(dateObj.getDate()) ? new Date().getDate() : dateObj.getDate();
    const month = isNaN(dateObj.getMonth()) ? new Date().getMonth() + 1 : dateObj.getMonth() + 1;
    const year = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();
    const dateTextVi = `Tp. Hồ Chí Minh, ngày ${day} tháng ${month} năm ${year}`;

    // =========================================================================
    // SHEET 1: PHIẾU TRÌNH
    // =========================================================================
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(tplBuf1);

    const s1 = wb.worksheets[0];
    s1.name = 'PHIẾU TRÌNH';
    s1.getCell('F5').value = dateTextVi;

    const suppliersA = [...new Set(itemsA.map(x => (x.supplier || '').trim()).filter(Boolean))].join(', ') || '-';
    const suppliersB = [...new Set(itemsB.map(x => (x.supplier || '').trim()).filter(Boolean))].join(', ') || '-';
    const purposesA = [...new Set(itemsA.map(x => (x.purpose || '').trim()).filter(Boolean))].join('; ') || 'Theo đề xuất của Hội sở phục vụ công việc';
    const purposesB = [...new Set(itemsB.map(x => (x.purpose || '').trim()).filter(Boolean))].join('; ') || 'Theo đề xuất của Đơn vị kinh doanh phục vụ công việc';

    const hasBothGroups = itemsA.length > 0 && itemsB.length > 0;

    let deltaS1 = 0;

    if (hasBothGroups) {
      // Điền nhóm A vào dòng 11
      s1.getCell('A11').value = 1;
      s1.getCell('B11').value = `Các tài sản cố định/Công cụ lao động theo bảng kê số: ${poData.po} - A. HỘI SỞ THANH TOÁN (Đính kèm bảng kê chi tiết)`;
      s1.getCell('C11').value = '-';
      s1.getCell('D11').value = '-';
      s1.getCell('E11').value = totalQtyA > 0 ? totalQtyA : '-';
      s1.getCell('F11').value = totalAmountA;
      s1.getCell('F11').numFmt = '#,##0';
      s1.getCell('G11').value = suppliersA;
      s1.getCell('H11').value = purposesA;
      s1.getRow(11).height = 55;

      // Chèn dòng 12 (Nhóm B) và dòng 13 (Tổng cộng)
      s1.spliceRows(12, 0, Array(8).fill(null), Array(8).fill(null));
      deltaS1 = 2;

      // Dòng 12: Nhóm B
      const row12 = s1.getRow(12);
      const row11 = s1.getRow(11);
      for (let c = 1; c <= 8; c++) {
        const targetCell = row12.getCell(c);
        const srcCell = row11.getCell(c);
        if (srcCell.style) targetCell.style = JSON.parse(JSON.stringify(srcCell.style));
      }
      row12.getCell(1).value = 2;
      row12.getCell(2).value = `Các tài sản cố định/Công cụ lao động theo bảng kê số: ${poData.po} - B. ĐƠN VỊ THANH TOÁN (Đính kèm bảng kê chi tiết)`;
      row12.getCell(3).value = '-';
      row12.getCell(4).value = '-';
      row12.getCell(5).value = totalQtyB > 0 ? totalQtyB : '-';
      row12.getCell(6).value = totalAmountB;
      row12.getCell(6).numFmt = '#,##0';
      row12.getCell(7).value = suppliersB;
      row12.getCell(8).value = purposesB;
      row12.height = 55;

      // Dòng 13: Dòng Tổng cộng chưa VAT
      const row13 = s1.getRow(13);
      for (let c = 1; c <= 8; c++) {
        const targetCell = row13.getCell(c);
        const srcCell = row11.getCell(c);
        if (srcCell.style) targetCell.style = JSON.parse(JSON.stringify(srcCell.style));
      }
      row13.getCell(1).value = 'TỔNG CỘNG CHƯA BAO GỒM VAT:';
      row13.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true };
      row13.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row13.getCell(6).value = grandTotalAmount;
      row13.getCell(6).numFmt = '#,##0';
      row13.getCell(6).font = { name: 'Times New Roman', size: 11, bold: true };
      row13.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      row13.getCell(7).value = '-';
      row13.getCell(8).value = '-';
      row13.height = 28;

    } else {
      // Chỉ có 1 nhóm
      const isOnlyA = itemsA.length > 0;
      const targetItems = isOnlyA ? itemsA : itemsB;
      const labelGroup = isOnlyA ? 'A. HỘI SỞ THANH TOÁN' : 'B. ĐƠN VỊ THANH TOÁN';
      const sup = isOnlyA ? suppliersA : suppliersB;
      const pur = isOnlyA ? purposesA : purposesB;
      const tQty = isOnlyA ? totalQtyA : totalQtyB;
      const tAmt = isOnlyA ? totalAmountA : totalAmountB;

      s1.getCell('A11').value = 1;
      s1.getCell('B11').value = `Các tài sản cố định/Công cụ lao động theo bảng kê số: ${poData.po} - ${labelGroup} (Đính kèm bảng kê chi tiết)`;
      s1.getCell('C11').value = '-';
      s1.getCell('D11').value = '-';
      s1.getCell('E11').value = tQty > 0 ? tQty : '-';
      s1.getCell('F11').value = tAmt;
      s1.getCell('F11').numFmt = '#,##0';
      s1.getCell('G11').value = sup;
      s1.getCell('H11').value = pur;
      s1.getRow(11).height = 55;

      // Chèn 1 dòng tổng cộng tại dòng 12
      s1.spliceRows(12, 0, Array(8).fill(null));
      deltaS1 = 1;

      const row12 = s1.getRow(12);
      const row11 = s1.getRow(11);
      for (let c = 1; c <= 8; c++) {
        const targetCell = row12.getCell(c);
        const srcCell = row11.getCell(c);
        if (srcCell.style) targetCell.style = JSON.parse(JSON.stringify(srcCell.style));
      }
      row12.getCell(1).value = 'TỔNG CỘNG CHƯA BAO GỒM VAT:';
      row12.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true };
      row12.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row12.getCell(6).value = grandTotalAmount;
      row12.getCell(6).numFmt = '#,##0';
      row12.getCell(6).font = { name: 'Times New Roman', size: 11, bold: true };
      row12.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      row12.getCell(7).value = '-';
      row12.getCell(8).value = '-';
      row12.height = 28;
    }

    // Tái tạo các ô gộp của Sheet 1 một cách an toàn và chuẩn xác
    const currentMerges1 = [...(s1.model.merges || [])];
    currentMerges1.forEach(m => { try { s1.unMergeCells(m); } catch(e){} });

    s1.mergeCells('F1:H1');
    s1.mergeCells('F2:H2');
    s1.mergeCells('F5:H5');
    s1.mergeCells('A8:H8');

    // Merge ô A:E của dòng Tổng cộng
    const totalRowS1 = 11 + deltaS1;
    s1.mergeCells(`A${totalRowS1}:E${totalRowS1}`);

    // Merge các ô của khu vực chữ ký
    s1.mergeCells(`G${13 + deltaS1}:H${13 + deltaS1}`);
    s1.mergeCells(`A${14 + deltaS1}:E${14 + deltaS1}`);
    s1.mergeCells(`C${24 + deltaS1}:F${24 + deltaS1}`);

    // =========================================================================
    // SHEET 2: BẢNG KÊ (Kế thừa từ template 2, chia 2 phần A & B rõ ràng)
    // =========================================================================
    const wbBangKe = new ExcelJS.Workbook();
    await wbBangKe.xlsx.load(tplBuf2);
    const srcBangKe = wbBangKe.worksheets[0];

    const s2 = wb.addWorksheet('BẢNG KÊ', {
      views: srcBangKe.views || [{ showGridLines: true }],
      pageSetup: srcBangKe.pageSetup || {}
    });

    // 1. Sao chép độ rộng 10 cột
    srcBangKe.columns.forEach((col, idx) => {
      if (col && col.width) s2.getColumn(idx + 1).width = col.width;
    });

    // 2. Sao chép dòng 1 đến 8 (Dòng tiêu đề và dòng nhóm A ban đầu)
    for (let r = 1; r <= 8; r++) {
      const srcRow = srcBangKe.getRow(r);
      const targetRow = s2.getRow(r);
      targetRow.height = srcRow.height;
      srcRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const targetCell = targetRow.getCell(colNumber);
        targetCell.value = cell.value;
        if (cell.style) targetCell.style = JSON.parse(JSON.stringify(cell.style));
      });
    }

    // Cập nhật tiêu đề Sheet 2
    s2.getCell('A4').value = poData.po;
    s2.getCell('J4').value = `Tp.HCM, Ngày ${day} tháng ${month} năm ${year}`;

    // Lấy các dòng mẫu từ template 2 để kế thừa style
    const sampleDataRow = srcBangKe.getRow(9);
    const headerRowB = srcBangKe.getRow(15);
    const totalRowSample = srcBangKe.getRow(17);
    const noteRowSample = srcBangKe.getRow(19);
    const sigRowSample = srcBangKe.getRow(20);

    // Helper điền dữ liệu hàng hóa vào 1 dòng
    const writeItemRow = (targetRowNumber, item, sttNumber) => {
      const row = s2.getRow(targetRowNumber);
      const qtyNum = Number(item.qty || 0);
      const priceNum = Number(item.price || 0);
      const amountNum = Number(item.amount || 0) || (qtyNum * priceNum);

      const vals = [
        sttNumber,
        item.date || '',
        item.unit || '',
        item.supplier || '',
        item.item || '',
        qtyNum,
        item.spec || '',
        priceNum,
        amountNum,
        item.purpose || ''
      ];

      for (let c = 1; c <= 10; c++) {
        const cell = row.getCell(c);
        const src = sampleDataRow.getCell(c);
        cell.value = vals[c - 1];
        if (src.style) cell.style = JSON.parse(JSON.stringify(src.style));
        cell.alignment = { ...(cell.alignment || {}), vertical: 'middle', wrapText: true };
        if ([1, 2, 6, 7].includes(c)) cell.alignment.horizontal = 'center';
        else if ([8, 9].includes(c)) cell.alignment.horizontal = 'right';
        else cell.alignment.horizontal = 'left';
        if ([6, 8, 9].includes(c)) cell.numFmt = '#,##0';
      }
      row.height = 32;
    };

    let currRow = 9;

    // 3. Ghi dữ liệu Phần A: Hội sở thanh toán
    if (itemsA.length > 0) {
      itemsA.forEach((item, idx) => {
        writeItemRow(currRow, item, idx + 1);
        currRow++;
      });
    } else {
      const r = s2.getRow(currRow);
      for (let c = 1; c <= 10; c++) {
        const src = sampleDataRow.getCell(c);
        if (src.style) r.getCell(c).style = JSON.parse(JSON.stringify(src.style));
      }
      r.getCell(1).value = '-';
      r.getCell(5).value = '(Không phát sinh thanh toán tại Hội sở)';
      r.height = 24;
      currRow++;
    }

    // Dòng Cộng (Hội sở thanh toán)
    const subtotalRowAIdx = currRow;
    const rowSubtotalA = s2.getRow(subtotalRowAIdx);
    for (let c = 1; c <= 10; c++) {
      const src = sampleDataRow.getCell(c);
      if (src.style) rowSubtotalA.getCell(c).style = JSON.parse(JSON.stringify(src.style));
    }
    rowSubtotalA.getCell(1).value = 'Cộng (Hội sở thanh toán):';
    rowSubtotalA.getCell(1).font = { name: 'Times New Roman', size: 10, bold: true };
    rowSubtotalA.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    rowSubtotalA.getCell(9).value = totalAmountA;
    rowSubtotalA.getCell(9).numFmt = '#,##0';
    rowSubtotalA.getCell(9).font = { name: 'Times New Roman', size: 10, bold: true };
    rowSubtotalA.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
    rowSubtotalA.height = 26;
    currRow++;

    // 4. Ghi tiêu đề Phần B: Đơn vị thanh toán
    const headerRowBIdx = currRow;
    const rowHeaderB = s2.getRow(headerRowBIdx);
    for (let c = 1; c <= 10; c++) {
      const src = headerRowB.getCell(c);
      if (src.style) rowHeaderB.getCell(c).style = JSON.parse(JSON.stringify(src.style));
    }
    rowHeaderB.getCell(1).value = 'B. ĐƠN VỊ THANH TOÁN';
    rowHeaderB.getCell(1).font = { name: 'Times New Roman', size: 10, bold: true };
    rowHeaderB.height = 24;
    currRow++;

    // Ghi dữ liệu Phần B: Đơn vị thanh toán
    if (itemsB.length > 0) {
      itemsB.forEach((item, idx) => {
        writeItemRow(currRow, item, idx + 1);
        currRow++;
      });
    } else {
      const r = s2.getRow(currRow);
      for (let c = 1; c <= 10; c++) {
        const src = sampleDataRow.getCell(c);
        if (src.style) r.getCell(c).style = JSON.parse(JSON.stringify(src.style));
      }
      r.getCell(1).value = '-';
      r.getCell(5).value = '(Không phát sinh thanh toán tại Đơn vị)';
      r.height = 24;
      currRow++;
    }

    // Dòng Cộng (Đơn vị thanh toán)
    const subtotalRowBIdx = currRow;
    const rowSubtotalB = s2.getRow(subtotalRowBIdx);
    for (let c = 1; c <= 10; c++) {
      const src = sampleDataRow.getCell(c);
      if (src.style) rowSubtotalB.getCell(c).style = JSON.parse(JSON.stringify(src.style));
    }
    rowSubtotalB.getCell(1).value = 'Cộng (Đơn vị thanh toán):';
    rowSubtotalB.getCell(1).font = { name: 'Times New Roman', size: 10, bold: true };
    rowSubtotalB.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    rowSubtotalB.getCell(9).value = totalAmountB;
    rowSubtotalB.getCell(9).numFmt = '#,##0';
    rowSubtotalB.getCell(9).font = { name: 'Times New Roman', size: 10, bold: true };
    rowSubtotalB.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
    rowSubtotalB.height = 26;
    currRow++;

    // 5. Dòng TỔNG CỘNG CHƯA BAO GỒM VAT
    const grandTotalRowIdx = currRow;
    const rowGrandTotal = s2.getRow(grandTotalRowIdx);
    for (let c = 1; c <= 10; c++) {
      const src = totalRowSample.getCell(c);
      if (src.style) rowGrandTotal.getCell(c).style = JSON.parse(JSON.stringify(src.style));
    }
    rowGrandTotal.getCell(1).value = 'TỔNG CỘNG CHƯA BAO GỒM VAT:';
    rowGrandTotal.getCell(1).font = { name: 'Times New Roman', size: 10, bold: true };
    rowGrandTotal.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    rowGrandTotal.getCell(9).value = grandTotalAmount;
    rowGrandTotal.getCell(9).numFmt = '#,##0';
    rowGrandTotal.getCell(9).font = { name: 'Times New Roman', size: 10, bold: true };
    rowGrandTotal.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
    rowGrandTotal.height = 28;
    currRow++;

    // 6. Dòng trống cách dòng
    currRow++;

    // 7. Dòng Ghi chú VAT
    const noteRowIdx = currRow;
    const rowNote = s2.getRow(noteRowIdx);
    for (let c = 1; c <= 10; c++) {
      const src = noteRowSample.getCell(c);
      if (src.style) rowNote.getCell(c).style = JSON.parse(JSON.stringify(src.style));
    }
    rowNote.getCell(1).value = 'Ghi chú: Thuế VAT theo quy định tại thời điểm.';
    rowNote.height = 22;
    currRow++;

    // 8. Dòng Chữ ký Lãnh đạo & Các phòng ban
    const sigRowIdx = currRow;
    const rowSig = s2.getRow(sigRowIdx);
    for (let c = 1; c <= 10; c++) {
      const src = sigRowSample.getCell(c);
      if (src.style) rowSig.getCell(c).style = JSON.parse(JSON.stringify(src.style));
    }
    rowSig.getCell(2).value = ' PHÒNG HCQT';
    rowSig.getCell(5).value = 'CVCC QTTS';
    rowSig.getCell(9).value = 'LẬP BẢNG';
    rowSig.height = 30;

    // 9. Sao chép logo từ srcBangKe sang Sheet 2
    const images2 = srcBangKe.getImages ? srcBangKe.getImages() : [];
    for (const img of images2) {
      const imgData = wbBangKe.getImage(img.imageId);
      if (imgData && imgData.buffer) {
        const newImgId = wb.addImage({ buffer: imgData.buffer, extension: imgData.extension || 'png' });
        s2.addImage(newImgId, img.range);
      }
    }

    // 10. Tái tạo các ô gộp của Sheet 2 chuẩn xác 100%
    s2.mergeCells('I1:J1');
    s2.mergeCells('I2:J2');
    s2.mergeCells('A5:J5');
    s2.mergeCells(`A${subtotalRowAIdx}:H${subtotalRowAIdx}`);
    s2.mergeCells(`A${subtotalRowBIdx}:H${subtotalRowBIdx}`);
    s2.mergeCells(`A${grandTotalRowIdx}:H${grandTotalRowIdx}`);

    s2.mergeCells(`B${sigRowIdx}:C${sigRowIdx}`);
    s2.mergeCells(`E${sigRowIdx}:G${sigRowIdx}`);
    s2.mergeCells(`I${sigRowIdx}:J${sigRowIdx}`);

    // =========================================================================
    // 11. KIỂM THỬ XÁC MINH SỰ KHỚP NỐI GIỮA 2 SHEET
    // =========================================================================
    const s1GrandTotal = Number(s1.getCell(`F${totalRowS1}`).value) || 0;
    const s2GrandTotal = Number(s2.getCell(`I${grandTotalRowIdx}`).value) || 0;
    if (Math.abs(s1GrandTotal - s2GrandTotal) > 0.01) {
      throw new Error(`Tổng tiền giữa Sheet 1 PHIẾU TRÌNH (${s1GrandTotal.toLocaleString('vi-VN')} đ) và Sheet 2 BẢNG KÊ (${s2GrandTotal.toLocaleString('vi-VN')} đ) không khớp nhau!`);
    }

    return wb;
  },

  /**
   * Xuất DUY NHẤT 01 FILE EXCEL chứa cả 2 Sheet (PHIẾU TRÌNH & BẢNG KÊ)
   * Tự động tải xuống trình duyệt
   * @param {object} poData 
   */
  async exportSingleExcelFile(poData) {
    const wb = await this.generateSingleProcurementWorkbook(poData);
    const buffer = await wb.xlsx.writeBuffer();

    const cleanPO = (poData.po || 'PO').replace(/[/\\?%*:|"<>]/g, '_');
    const fileName = `${cleanPO}_Ho_so_mua_sam.xlsx`;

    triggerFileDownload(buffer, fileName);

    return { success: true, fileName, po: poData.po };
  },

  /**
   * Phương thức tương thích ngược
   */
  async exportBothExcelFiles(poData) {
    return this.exportSingleExcelFile(poData);
  }
};
