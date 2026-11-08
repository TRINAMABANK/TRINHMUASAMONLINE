import ExcelJS from 'exceljs';
import { TEMPLATE_CONFIG } from './templateMapper.js';
import { NAM_A_BANK_LOGO_BASE64 } from '../assets/namabankLogoBase64.js';
import { formatExcelDate } from '../utils/dateUtils.js';
import { getUnitContact } from '../utils/supplierDirectory.js';

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
 * - Nhóm I: Hội sở thanh toán (HOI_SO)
 * - Nhóm II: Đơn vị thanh toán (DON_VI)
 * @param {Array} items 
 * @returns {{ itemsA: Array, itemsB: Array, allSelected: Array }}
 */
export function categorizePayGroups(items = []) {
  const selected = items.filter(x => x.selected !== false);
  const itemsA = [];
  const itemsB = [];

  selected.forEach(item => {
    // Nếu có trường payGroup cụ thể (Hỗ trợ HOI_SO, DON_VI, A, B)
    const pg = String(item.payGroup || '').trim().toUpperCase();
    if (pg === 'HOI_SO' || pg === 'A' || pg === 'HO' || pg === 'HOI SO') {
      itemsA.push(item);
    } else if (pg === 'DON_VI' || pg === 'B' || pg === 'DV' || pg === 'DON VI') {
      itemsB.push(item);
    } else {
      // Tự động nhận diện theo tên đơn vị
      const unit = String(item.unit || item.unit_name || '').toLowerCase();
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
 * Ước tính chính xác số dòng thực tế được hiển thị sau khi Word-Wrap trong Excel
 * để tự động tăng chiều cao dòng (row.height), chống 100% hiện tượng đè chữ, mất chữ, che chữ.
 * @param {string} text 
 * @param {number} colWidth 
 * @returns {number}
 */
function estimateCellLines(text, colWidth) {
  if (!text) return 1;
  const str = String(text).trim();
  if (!str) return 1;

  const paragraphs = str.split(/\r?\n/);
  // Với font Times New Roman 11pt, hệ số an toàn ký tự/dòng = colWidth * 0.72
  const charsPerLine = Math.max(8, Math.floor(colWidth * 0.72));
  let totalLines = 0;

  for (const para of paragraphs) {
    const pTrim = para.trim();
    if (!pTrim) {
      totalLines += 1;
      continue;
    }
    const wrapped = Math.max(1, Math.ceil(pTrim.length / charsPerLine));
    totalLines += wrapped;
  }

  return Math.max(1, totalLines);
}

/**
 * Service xuất DUY NHẤT 01 FILE EXCEL gồm đúng 02 SHEET:
 * SHEET 1: PHIẾU TRÌNH (Chỉ có 01 dòng dữ liệu tổng hợp duy nhất)
 * SHEET 2: BẢNG KÊ (Giữ nguyên 02 nhóm thanh toán: Nhóm I - Hội sở & Nhóm II - Đơn vị, có subtotal và tổng cuối bảng)
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

    // 1. Phân loại sản phẩm thành 2 nhóm: Nhóm I - Hội sở thanh toán & Nhóm II - Đơn vị thanh toán
    const { itemsA, itemsB, allSelected } = categorizePayGroups(poData.items);
    if (allSelected.length === 0) {
      throw new Error('Hồ sơ không có dòng sản phẩm nào được chọn để xuất.');
    }

    // Tính toán số liệu từng nhóm và tổng cộng
    const totalQtyA = itemsA.reduce((s, x) => s + (Number(x.qty) || 0), 0);
    const totalAmountA = itemsA.reduce((s, x) => s + (Number(x.amount) || (Number(x.qty) * Number(x.price)) || 0), 0);
    const totalQtyB = itemsB.reduce((s, x) => s + (Number(x.qty) || 0), 0);
    const totalAmountB = itemsB.reduce((s, x) => s + (Number(x.amount) || (Number(x.qty) * Number(x.price)) || 0), 0);

    const grandTotalQty = totalQtyA + totalQtyB;
    const grandTotalAmount = totalAmountA + totalAmountB;

    // Ngày tháng định dạng Việt Nam
    const dateObj = poData.date ? new Date(poData.date) : new Date();
    const day = isNaN(dateObj.getDate()) ? new Date().getDate() : dateObj.getDate();
    const month = isNaN(dateObj.getMonth()) ? new Date().getMonth() + 1 : dateObj.getMonth() + 1;
    const year = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();
    const dateTextVi = `Tp. Hồ Chí Minh, ngày ${day} tháng ${month} năm ${year}`;

    // Danh sách toàn bộ các nhà cung cấp phân cách bằng dấu phẩy
    const allSuppliers = [...new Set(allSelected.map(x => (x.supplier || '').trim()).filter(Boolean))].join(', ') || '-';
    const defaultPurpose = 'Trang bị mua sắm mới/thay thế cho các Đơn vị khu vực Miền Bắc';

    // =========================================================================
    // SHEET 1: PHIẾU TRÌNH
    // YÊU CẦU BẮT BUỘC: CHỈ CÓ ĐÚNG 01 HÀNG DỮ LIỆU TỔNG HỢP DUY NHẤT
    // =========================================================================
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(tplBuf1);

    const s1 = wb.worksheets[0];
    s1.name = 'PHIẾU TRÌNH';

    // Đăng ký Logo Nam A Bank chuẩn vào Workbook
    const logoId = wb.addImage({
      base64: NAM_A_BANK_LOGO_BASE64,
      extension: 'png'
    });

    // Chèn Logo Nam A Bank tại góc trên cùng bên trái của Sheet 1
    s1.addImage(logoId, {
      tl: { col: 0.05, row: 0.1 },
      ext: { width: 175, height: 43 },
      editAs: 'undefined'
    });

    // Thiết lập độ cao các hàng phần Header Sheet 1
    s1.getRow(1).height = 36;
    s1.getRow(2).height = 18;
    s1.getRow(3).height = 16;
    s1.getRow(4).height = 16;
    s1.getRow(5).height = 18;
    s1.getRow(6).height = 10;
    s1.getRow(7).height = 8;
    s1.getRow(8).height = 28;
    s1.getRow(9).height = 10;

    // Header góc trên bên trái: Thông tin Hội sở Nam A Bank
    s1.getCell('A2').value = 'NAM A BANK - HỘI SỞ';
    s1.getCell('A2').font = { name: 'Times New Roman', size: 10.5, bold: true, color: { argb: 'FF003366' } };
    s1.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

    s1.getCell('A3').value = '201-203 Cách Mạng Tháng Tám, P. Bàn Cờ, TP. HCM';
    s1.getCell('A3').font = { name: 'Times New Roman', size: 9, color: { argb: 'FF333333' } };
    s1.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };

    s1.getCell('A4').value = '[T] 08 3929 6699 - [F] 08 3929 6688';
    s1.getCell('A4').font = { name: 'Times New Roman', size: 9, color: { argb: 'FF333333' } };
    s1.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle' };

    s1.getCell('A5').value = '[Hotline] 1900 6679 - [W] www.namabank.com.vn';
    s1.getCell('A5').font = { name: 'Times New Roman', size: 9, color: { argb: 'FF333333' } };
    s1.getCell('A5').alignment = { horizontal: 'left', vertical: 'middle' };

    // Cột bên phải đối xứng: Quốc hiệu & Tiêu ngữ & Ngày tháng
    s1.getCell('F1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
    s1.getCell('F1').font = { name: 'Times New Roman', size: 11, bold: true };
    s1.getCell('F1').alignment = { horizontal: 'center', vertical: 'middle' };

    s1.getCell('F2').value = 'Độc lập – Tự do – Hạnh phúc';
    s1.getCell('F2').font = { name: 'Times New Roman', size: 10.5, bold: true };
    s1.getCell('F2').alignment = { horizontal: 'center', vertical: 'middle' };

    s1.getCell('F5').value = dateTextVi;
    s1.getCell('F5').font = { name: 'Times New Roman', size: 11, italic: true };
    s1.getCell('F5').alignment = { horizontal: 'center', vertical: 'middle' };

    // Ghi ĐÚNG 01 HÀNG TỔNG HỢP vào Dòng 11
    s1.getCell('A11').value = 1;
    s1.getCell('B11').value = `Mua sắm Các tài sản cố định/Công cụ lao động theo bảng kê số: ${poData.po} (Đính kèm bảng kê chi tiết)`;
    s1.getCell('C11').value = '-';
    s1.getCell('D11').value = '-';
    s1.getCell('E11').value = grandTotalQty > 0 ? grandTotalQty : '-';
    s1.getCell('F11').value = grandTotalAmount;
    s1.getCell('F11').numFmt = '#,##0';
    s1.getCell('G11').value = allSuppliers;
    s1.getCell('H11').value = defaultPurpose;

    // Định dạng wrapText và căn chỉnh dòng 11
    const row11 = s1.getRow(11);
    for (let c = 1; c <= 8; c++) {
      const cell = row11.getCell(c);
      cell.alignment = { ...(cell.alignment || {}), vertical: 'middle', wrapText: true };
      if ([1, 3, 4, 5].includes(c)) cell.alignment.horizontal = 'center';
      else if (c === 6) cell.alignment.horizontal = 'right';
      else cell.alignment.horizontal = 'left';
    }

    // Chiều cao dòng tự động co giãn theo độ dài tên NCC và mục đích sử dụng
    const linesS1Supplier = estimateCellLines(allSuppliers, 16);
    const linesS1Title = estimateCellLines(String(s1.getCell('B11').value || ''), 34);
    const maxS1Lines = Math.max(linesS1Supplier, linesS1Title, 3);
    row11.height = Math.max(55, maxS1Lines * 18.5 + 12);

    // Chèn ĐÚNG 01 DÒNG TỔNG CỘNG CHƯA BAO GỒM VAT tại Dòng 12
    s1.spliceRows(12, 0, Array(8).fill(null));
    const deltaS1 = 1;

    const row12 = s1.getRow(12);
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

    // Tái tạo các ô gộp của Sheet 1 một cách an toàn và chuẩn xác
    const currentMerges1 = [...(s1.model.merges || [])];
    currentMerges1.forEach(m => { try { s1.unMergeCells(m); } catch(e){} });

    s1.mergeCells('A2:D2');
    s1.mergeCells('A3:D3');
    s1.mergeCells('A4:D4');
    s1.mergeCells('A5:D5');
    s1.mergeCells('F1:H1');
    s1.mergeCells('F2:H2');
    s1.mergeCells('F5:H5');
    s1.mergeCells('A8:H8');

    // Merge ô A:E của dòng Tổng cộng (Dòng 12)
    const totalRowS1 = 11 + deltaS1;
    s1.mergeCells(`A${totalRowS1}:E${totalRowS1}`);

    // Merge các ô của khu vực chữ ký (dịch xuống đúng 1 dòng)
    s1.mergeCells(`G${13 + deltaS1}:H${13 + deltaS1}`);
    s1.mergeCells(`A${14 + deltaS1}:E${14 + deltaS1}`);
    s1.mergeCells(`C${24 + deltaS1}:F${24 + deltaS1}`);

    // =========================================================================
    // SHEET 2: BẢNG KÊ
    // GIỮ NGUYÊN 02 NHÓM: NHÓM I - HỘI SỞ THANH TOÁN & NHÓM II - ĐƠN VỊ THANH TOÁN
    // ĐỒNG NHẤT HEADER NAM A BANK GÓC TRÊN TRÁI ĐÚNG CHUẨN
    // =========================================================================
    const wbBangKe = new ExcelJS.Workbook();
    await wbBangKe.xlsx.load(tplBuf2);
    const srcBangKe = wbBangKe.worksheets[0];

    const s2 = wb.addWorksheet('BẢNG KÊ', {
      views: [{ showGridLines: true }]
    });

    // 1. THIẾT LẬP ĐỘ RỘNG 10 CỘT RỘNG RÃI, THOÁNG ĐÃNG ĐẢM BẢO CHỮ KHÔNG BỊ ÉP
    s2.getColumn(1).width = 6.5;   // Col A: STT
    s2.getColumn(2).width = 14;    // Col B: Ngày đề xuất
    s2.getColumn(3).width = 28;    // Col C: Tên đơn vị (rộng rãi, không bị ép chữ)
    s2.getColumn(4).width = 25;    // Col D: Nhà cung cấp
    s2.getColumn(5).width = 56;    // Col E: Nội dung / Tên hàng hóa (rất rộng, thoáng đãng, chống đè chữ)
    s2.getColumn(6).width = 8;     // Col F: SL
    s2.getColumn(7).width = 12;    // Col G: Quy cách
    s2.getColumn(8).width = 16;    // Col H: Đơn giá chưa VAT
    s2.getColumn(9).width = 18;    // Col I: Thành tiền chưa VAT
    s2.getColumn(10).width = 56;   // Col J: Mục đích sử dụng (bảo toàn MSP, đủ chỗ cho 5-6 dòng text)

    // Chèn Logo Nam A Bank vào góc trên cùng bên trái của Sheet 2
    s2.addImage(logoId, {
      tl: { col: 0.05, row: 0.1 },
      ext: { width: 175, height: 43 },
      editAs: 'undefined'
    });

    // 2. Thiết lập Header Nam A Bank cho Sheet 2 (Dòng 1 đến 5)
    s2.getRow(1).height = 36;
    s2.getRow(2).height = 18;
    s2.getRow(3).height = 16;
    s2.getRow(4).height = 16;
    s2.getRow(5).height = 18;
    s2.getRow(6).height = 10; // Khoảng cách đệm
    s2.getRow(7).height = 22; // Mã PO & ĐVT
    s2.getRow(8).height = 32; // Tiêu đề Bảng Kê
    s2.getRow(9).height = 10; // Khoảng cách đệm
    s2.getRow(10).height = 32; // Header 10 cột dữ liệu

    // Thông tin Hội sở Nam A Bank (Góc trên trái)
    s2.getCell('A2').value = 'NAM A BANK - HỘI SỞ';
    s2.getCell('A2').font = { name: 'Times New Roman', size: 10.5, bold: true, color: { argb: 'FF003366' } };
    s2.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

    s2.getCell('A3').value = '201-203 Cách Mạng Tháng Tám, P. Bàn Cờ, TP. HCM';
    s2.getCell('A3').font = { name: 'Times New Roman', size: 9, color: { argb: 'FF333333' } };
    s2.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };

    s2.getCell('A4').value = '[T] 08 3929 6699 - [F] 08 3929 6688';
    s2.getCell('A4').font = { name: 'Times New Roman', size: 9, color: { argb: 'FF333333' } };
    s2.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle' };

    s2.getCell('A5').value = '[Hotline] 1900 6679 - [W] www.namabank.com.vn';
    s2.getCell('A5').font = { name: 'Times New Roman', size: 9, color: { argb: 'FF333333' } };
    s2.getCell('A5').alignment = { horizontal: 'left', vertical: 'middle' };

    // Phía bên phải đối xứng: Quốc hiệu & Tiêu ngữ
    s2.getCell('I1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
    s2.getCell('I1').font = { name: 'Times New Roman', size: 11, bold: true };
    s2.getCell('I1').alignment = { horizontal: 'center', vertical: 'middle' };

    s2.getCell('I2').value = 'ĐỘC LẬP - TỰ DO - HẠNH PHÚC';
    s2.getCell('I2').font = { name: 'Times New Roman', size: 10.5, bold: true };
    s2.getCell('I2').alignment = { horizontal: 'center', vertical: 'middle' };

    s2.getCell('I5').value = `Tp.HCM, Ngày ${day} tháng ${month} năm ${year}`;
    s2.getCell('I5').font = { name: 'Times New Roman', size: 11, italic: true };
    s2.getCell('I5').alignment = { horizontal: 'center', vertical: 'middle' };

    // Dòng 7: Mã PO & ĐVT
    s2.getCell('A7').value = poData.po;
    s2.getCell('A7').font = { name: 'Times New Roman', size: 11, bold: true };
    s2.getCell('A7').alignment = { horizontal: 'left', vertical: 'middle' };

    s2.getCell('I7').value = 'ĐVT: đồng';
    s2.getCell('I7').font = { name: 'Times New Roman', size: 10, italic: true };
    s2.getCell('I7').alignment = { horizontal: 'right', vertical: 'middle' };

    // Dòng 8: Tiêu đề Bảng Kê (In hoa, đậm, to rõ, căn giữa)
    s2.getCell('A8').value = 'BẢNG KÊ YÊU CẦU MUA SẮM HÀNG HÓA, DỊCH VỤ';
    s2.getCell('A8').font = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FF000000' } };
    s2.getCell('A8').alignment = { horizontal: 'center', vertical: 'middle' };

    // Lấy các dòng mẫu từ template 2 để kế thừa style chuẩn ngân hàng
    const groupHeaderSample = srcBangKe.getRow(8);
    const sampleDataRow = srcBangKe.getRow(9);
    const totalRowSample = srcBangKe.getRow(17);
    const noteRowSample = srcBangKe.getRow(19);
    const sigRowSample = srcBangKe.getRow(20);

    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
    };

    // Dòng 10: Header 10 cột dữ liệu kế thừa từ mẫu template
    const headerCols = [
      'STT', 'Ngày đề xuất', 'Tên đơn vị', 'Nhà cung cấp', 'Nội dung',
      'SL', 'Quy cách', 'Đơn giá\nchưa VAT', 'Thành tiền\nchưa VAT', 'Mục đích sử dụng'
    ];
    const row10 = s2.getRow(10);
    const srcHeaderRow = srcBangKe.getRow(7);

    for (let c = 1; c <= 10; c++) {
      const cell = row10.getCell(c);
      const srcCell = srcHeaderRow.getCell(c);
      if (srcCell.style) cell.style = JSON.parse(JSON.stringify(srcCell.style));
      cell.value = headerCols[c - 1];
      cell.border = thinBorder;
      cell.font = { name: 'Times New Roman', size: 10.5, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }

    // Tái tạo các ô gộp phần Header của Sheet 2
    s2.mergeCells('A2:E2');
    s2.mergeCells('A3:E3');
    s2.mergeCells('A4:E4');
    s2.mergeCells('A5:E5');
    s2.mergeCells('I1:J1');
    s2.mergeCells('I2:J2');
    s2.mergeCells('I5:J5');
    s2.mergeCells('A7:E7');
    s2.mergeCells('I7:J7');
    s2.mergeCells('A8:J8');

    // Helper ghi dòng tiêu đề nhóm (Nhóm I hoặc Nhóm II)
    const writeGroupHeader = (targetRowNumber, groupTitle) => {
      const row = s2.getRow(targetRowNumber);
      for (let c = 1; c <= 10; c++) {
        const cell = row.getCell(c);
        const src = groupHeaderSample.getCell(c);
        if (src.style) cell.style = JSON.parse(JSON.stringify(src.style));
        cell.border = thinBorder;
        cell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF003366' } };
      }
      row.getCell(1).value = groupTitle;
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      row.height = 28;
    };

    // Helper ghi 1 dòng dữ liệu hàng hóa với tính toán chiều cao tự động CHÍNH XÁC TUYỆT ĐỐI
    const writeItemRow = (targetRowNumber, item, sttNumber) => {
      const row = s2.getRow(targetRowNumber);
      const qtyNum = Number(item.qty || 0);
      const priceNum = Number(item.price || 0);
      const amountNum = Number(item.amount || 0) || (qtyNum * priceNum);

      const unitText = item.unit || item.unit_name || '';
      const supplierText = item.supplier || item.supplier_name || '';
      const itemText = item.item || item.name || '';
      const purposeText = item.purpose || '';

      // Ngày đề xuất: lấy từ item.date, item.request_date, poData.date hoặc ngày hiện tại (không bao giờ để trống)
      let rawDate = item.date || item.request_date || poData.date;
      if (!rawDate || String(rawDate).trim() === '' || String(rawDate).toLowerCase() === 'invalid date') {
        rawDate = poData.date || new Date();
      }
      let formattedItemDate = formatExcelDate(rawDate);
      if (!formattedItemDate || formattedItemDate === 'Invalid Date') {
        formattedItemDate = formatExcelDate(new Date());
      }

      const vals = [
        sttNumber,
        formattedItemDate,
        unitText,
        supplierText,
        itemText,
        qtyNum,
        item.spec || '',
        priceNum,
        amountNum,
        purposeText
      ];

      for (let c = 1; c <= 10; c++) {
        const cell = row.getCell(c);
        const src = sampleDataRow.getCell(c);
        cell.value = vals[c - 1];
        if (src.style) cell.style = JSON.parse(JSON.stringify(src.style));
        cell.border = thinBorder;
        cell.font = { name: 'Times New Roman', size: 10.5 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: [1, 2, 6, 7].includes(c) ? 'center' : [8, 9].includes(c) ? 'right' : 'left',
          wrapText: true
        };
        if ([6, 8, 9].includes(c)) cell.numFmt = '#,##0';
      }

      // TÍNH TOÁN CHIỀU CAO DÒNG TỰ ĐỘNG CHUẨN XÁC THEO SỐ DÒNG WRAP
      // Cột C (width 28), Cột D (width 25), Cột E (width 56), Cột J (width 56)
      const linesUnit = estimateCellLines(unitText, 28);
      const linesSup = estimateCellLines(supplierText, 25);
      const linesItem = estimateCellLines(itemText, 56);
      const linesPur = estimateCellLines(purposeText, 56);

      const maxLines = Math.max(linesUnit, linesSup, linesItem, linesPur, 1);

      // Chiều cao tiêu chuẩn: Mỗi dòng chiếm ~21pt + 12pt padding đệm an toàn trên dưới
      // Đảm bảo chữ hoàn toàn nằm trọn trong ô, KHÔNG BAO GIỜ bị đè chữ / che chữ / lem sang dòng khác
      row.height = Math.max(34, maxLines * 21 + 12);
    };

    // Dữ liệu bắt đầu từ Dòng 11 (sau Header 10 cột tại dòng 10)
    let currRow = 11;
    const mergeRangesToApply = [];

    // -------------------------------------------------------------------------
    // PHẦN 1: NHÓM I – HỘI SỞ THANH TOÁN
    // -------------------------------------------------------------------------
    const group1HeaderRow = currRow;
    writeGroupHeader(group1HeaderRow, 'NHÓM I – HỘI SỞ THANH TOÁN');
    mergeRangesToApply.push(`A${group1HeaderRow}:J${group1HeaderRow}`);
    currRow++;

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
        r.getCell(c).border = thinBorder;
        r.getCell(c).font = { name: 'Times New Roman', size: 10 };
      }
      r.getCell(1).value = '-';
      r.getCell(5).value = '(Không có hàng hóa thuộc Nhóm I - Hội sở thanh toán)';
      r.height = 26;
      currRow++;
    }

    // -------------------------------------------------------------------------
    // PHẦN 2: NHÓM II – ĐƠN VỊ THANH TOÁN
    // -------------------------------------------------------------------------
    const group2HeaderRow = currRow;
    writeGroupHeader(group2HeaderRow, 'NHÓM II – ĐƠN VỊ THANH TOÁN');
    mergeRangesToApply.push(`A${group2HeaderRow}:J${group2HeaderRow}`);
    currRow++;

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
        r.getCell(c).border = thinBorder;
        r.getCell(c).font = { name: 'Times New Roman', size: 10 };
      }
      r.getCell(1).value = '-';
      r.getCell(5).value = '(Không có hàng hóa thuộc Nhóm II - Đơn vị thanh toán)';
      r.height = 26;
      currRow++;
    }

    // -------------------------------------------------------------------------
    // CUỐI BẢNG:
    // Đã bỏ dòng TỔNG TIỀN NHÓM I và TỔNG TIỀN NHÓM II theo đúng yêu cầu người dùng
    // Chỉ ghi duy nhất 01 DÒNG TỔNG CỘNG TOÀN BỘ BẢNG KÊ (CHƯA VAT)
    // -------------------------------------------------------------------------
    const grandTotalRowIdx = currRow;
    const rowGrandTotal = s2.getRow(grandTotalRowIdx);
    for (let c = 1; c <= 10; c++) {
      const src = totalRowSample.getCell(c);
      if (src.style) rowGrandTotal.getCell(c).style = JSON.parse(JSON.stringify(src.style));
      rowGrandTotal.getCell(c).border = thinBorder;
    }
    rowGrandTotal.getCell(1).value = 'TỔNG CỘNG CHƯA BAO GỒM VAT:';
    rowGrandTotal.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF000000' } };
    rowGrandTotal.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    rowGrandTotal.getCell(9).value = grandTotalAmount;
    rowGrandTotal.getCell(9).numFmt = '#,##0';
    rowGrandTotal.getCell(9).font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF000000' } };
    rowGrandTotal.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
    rowGrandTotal.height = 30;
    mergeRangesToApply.push(`A${grandTotalRowIdx}:H${grandTotalRowIdx}`);
    currRow++;

    // 4. Dòng trống cách dòng
    currRow++;

    // 5. Dòng Ghi chú VAT
    const noteRowIdx = currRow;
    const rowNote = s2.getRow(noteRowIdx);
    for (let c = 1; c <= 10; c++) {
      const src = noteRowSample.getCell(c);
      if (src.style) rowNote.getCell(c).style = JSON.parse(JSON.stringify(src.style));
    }
    rowNote.getCell(1).value = 'Ghi chú: Thuế VAT theo quy định tại thời điểm.';
    rowNote.font = { name: 'Times New Roman', size: 10, italic: true };
    rowNote.height = 24;
    mergeRangesToApply.push(`A${noteRowIdx}:J${noteRowIdx}`);
    currRow++;

    // 6. Dòng Chữ ký Lãnh đạo & Các phòng ban
    const sigRowIdx = currRow;
    const rowSig = s2.getRow(sigRowIdx);
    for (let c = 1; c <= 10; c++) {
      const src = sigRowSample.getCell(c);
      if (src.style) rowSig.getCell(c).style = JSON.parse(JSON.stringify(src.style));
    }
    rowSig.getCell(2).value = ' PHÒNG HCQT';
    rowSig.getCell(5).value = 'CVCC QTTS';
    rowSig.getCell(9).value = 'LẬP BẢNG';
    rowSig.height = 32;

    mergeRangesToApply.push(`B${sigRowIdx}:C${sigRowIdx}`);
    mergeRangesToApply.push(`E${sigRowIdx}:G${sigRowIdx}`);
    mergeRangesToApply.push(`I${sigRowIdx}:J${sigRowIdx}`);

    // Áp dụng các merge động cho subtotal và summary
    mergeRangesToApply.forEach(range => {
      try { s2.mergeCells(range); } catch(e){}
    });

    // =========================================================================
    // 9. THIẾT LẬP TRANG IN VÀ XUẤT PDF CHUẨN KHỔ A4 NGANG CHO CẢ 2 SHEET
    // =========================================================================
    s1.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      printArea: `A1:H${totalRowS1 + 14}`
    };

    s2.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      printArea: `A1:J${sigRowIdx + 4}`
    };

    // =========================================================================
    // 10. ĐỐI CHIẾU SỐ LIỆU CHẶT CHẼ GIỮA 2 SHEET:
    // Tổng tiền PHIẾU TRÌNH = Tổng tiền Nhóm I + Tổng tiền Nhóm II trên BẢNG KÊ
    // =========================================================================
    const s1GrandTotal = Number(s1.getCell(`F${totalRowS1}`).value) || 0;
    const s2GrandTotal = Number(s2.getCell(`I${grandTotalRowIdx}`).value) || 0;
    const s2SumGroups = totalAmountA + totalAmountB;

    if (Math.abs(s1GrandTotal - s2GrandTotal) > 0.01) {
      throw new Error(`Tổng tiền giữa Sheet 1 PHIẾU TRÌNH (${s1GrandTotal.toLocaleString('vi-VN')} đ) và Sheet 2 BẢNG KÊ (${s2GrandTotal.toLocaleString('vi-VN')} đ) không khớp nhau!`);
    }

    if (Math.abs(s2SumGroups - s2GrandTotal) > 0.01) {
      throw new Error(`Tổng tiền Nhóm I (${totalAmountA}) + Nhóm II (${totalAmountB}) != Tổng cộng Bảng kê (${s2GrandTotal})!`);
    }

    // =========================================================================
    // 11. ĐỒNG BỘ TOÀN BỘ FONT THÀNH "TIMES NEW ROMAN" CHO CẢ 2 SHEET
    // Theo đúng yêu cầu: "các font trong PHIẾU TRÌNH VÀ BẢNG KÊ phải là font TIMES NEWS ROMAN"
    // =========================================================================
    const forceTimesNewRoman = (sheet) => {
      sheet.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          if (cell.font) {
            cell.font = {
              ...cell.font,
              name: 'Times New Roman'
            };
          } else {
            cell.font = { name: 'Times New Roman', size: 11 };
          }

          if (cell.value && typeof cell.value === 'object' && Array.isArray(cell.value.richText)) {
            cell.value.richText.forEach(run => {
              if (run.font) {
                run.font.name = 'Times New Roman';
              } else {
                run.font = { name: 'Times New Roman' };
              }
            });
          }
        });
      });
    };

    forceTimesNewRoman(s1);
    forceTimesNewRoman(s2);

    return wb;
  },

  /**
   * Xuất DUY NHẤT 01 FILE EXCEL chứa cả 2 Sheet (PHIẾU TRÌNH & BẢNG KÊ)
   * Tự động tải xuống trình duyệt
   * @param {object} poData 
   * @param {string} [customFileName] Tên file tùy biến nếu muốn
   */
  async exportSingleExcelFile(poData, customFileName = null) {
    const wb = await this.generateSingleProcurementWorkbook(poData);
    const buffer = await wb.xlsx.writeBuffer();

    const cleanPO = (poData.po || 'PO').replace(/[/\\?%*:|"<>]/g, '_');
    const fileName = customFileName || `${cleanPO}_Ho_so_mua_sam.xlsx`;

    triggerFileDownload(buffer, fileName);

    return { success: true, fileName, po: poData.po };
  },

  /**
   * Phương thức tương thích ngược
   */
  async exportBothExcelFiles(poData) {
    return this.exportSingleExcelFile(poData);
  },

  /**
   * Tạo Workbook ĐƠN ĐẶT HÀNG RIÊNG CHO 01 NHÀ CUNG CẤP
   * ĐÚNG 9 CỘT THEO MỤC B:
   * 1. STT | 2. Ngày đăng ký | 3. Tên hàng hóa | 4. SL | 5. Đơn giá | 6. Thành tiền | 7. Địa chỉ | 8. Người liên hệ | 9. Số điện thoại
   * @param {object} params
   * @param {object} params.poData
   * @param {string} params.supplierCode
   * @param {string} params.supplierName
   * @param {Array} [params.items]
   * @returns {Promise<ExcelJS.Workbook>}
   */
  async generateSupplierOrderWorkbook({ poData, supplierCode = 'NCC', supplierName = 'Nhà cung cấp', items = [] }) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('ĐƠN ĐẶT HÀNG', {
      views: [{ showGridLines: true }]
    });

    // 1. THIẾT LẬP ĐỘ RỘNG 9 CỘT CHUẨN XÁC, THOÁNG ĐÃNG
    ws.getColumn(1).width = 6.5;   // Col 1 (A): STT
    ws.getColumn(2).width = 14;    // Col 2 (B): Ngày đăng ký
    ws.getColumn(3).width = 50;    // Col 3 (C): Tên hàng hóa
    ws.getColumn(4).width = 8;     // Col 4 (D): SL
    ws.getColumn(5).width = 16;    // Col 5 (E): Đơn giá
    ws.getColumn(6).width = 18;    // Col 6 (F): Thành tiền
    ws.getColumn(7).width = 45;    // Col 7 (G): Địa chỉ
    ws.getColumn(8).width = 25;    // Col 8 (H): Người liên hệ
    ws.getColumn(9).width = 20;    // Col 9 (I): Số điện thoại

    // Đăng ký Logo Nam A Bank
    const logoId = wb.addImage({
      base64: NAM_A_BANK_LOGO_BASE64,
      extension: 'png'
    });

    // Chèn Logo góc trên bên trái
    ws.addImage(logoId, {
      tl: { col: 0.05, row: 0.1 },
      ext: { width: 175, height: 43 },
      editAs: 'undefined'
    });

    // 2. Thiết lập độ cao Header
    ws.getRow(1).height = 36;
    ws.getRow(2).height = 18;
    ws.getRow(3).height = 16;
    ws.getRow(4).height = 16;
    ws.getRow(5).height = 18;
    ws.getRow(6).height = 10; // Khoảng đệm
    ws.getRow(7).height = 22; // Mã PO & ĐVT
    ws.getRow(8).height = 34; // Tiêu đề ĐƠN ĐẶT HÀNG
    ws.getRow(9).height = 24; // Kính gửi NCC
    ws.getRow(10).height = 22; // Ngày phát hành
    ws.getRow(11).height = 8;  // Khoảng đệm
    ws.getRow(12).height = 32; // Header 9 cột

    // Header góc trên trái: Thông tin Hội sở Nam A Bank
    ws.getCell('A2').value = 'NAM A BANK - HỘI SỞ';
    ws.getCell('A2').font = { name: 'Times New Roman', size: 10.5, bold: true, color: { argb: 'FF003366' } };
    ws.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

    ws.getCell('A3').value = '201-203 Cách Mạng Tháng Tám, P. Bàn Cờ, TP. HCM';
    ws.getCell('A3').font = { name: 'Times New Roman', size: 9, color: { argb: 'FF333333' } };
    ws.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };

    ws.getCell('A4').value = '[T] 08 3929 6699 - [Hotline] 1900 6679';
    ws.getCell('A4').font = { name: 'Times New Roman', size: 9, color: { argb: 'FF333333' } };
    ws.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle' };

    ws.getCell('A5').value = '[W] www.namabank.com.vn';
    ws.getCell('A5').font = { name: 'Times New Roman', size: 9, color: { argb: 'FF333333' } };
    ws.getCell('A5').alignment = { horizontal: 'left', vertical: 'middle' };

    // Header góc trên phải: Quốc hiệu, Tiêu ngữ, Ngày tháng
    const dateObj = poData.date ? new Date(poData.date) : new Date();
    const day = isNaN(dateObj.getDate()) ? new Date().getDate() : dateObj.getDate();
    const month = isNaN(dateObj.getMonth()) ? new Date().getMonth() + 1 : dateObj.getMonth() + 1;
    const year = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();
    const dateTextVi = `Tp. Hồ Chí Minh, ngày ${day} tháng ${month} năm ${year}`;

    ws.getCell('F1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
    ws.getCell('F1').font = { name: 'Times New Roman', size: 11, bold: true };
    ws.getCell('F1').alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell('F2').value = 'Độc lập – Tự do – Hạnh phúc';
    ws.getCell('F2').font = { name: 'Times New Roman', size: 10.5, bold: true };
    ws.getCell('F2').alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getCell('F5').value = dateTextVi;
    ws.getCell('F5').font = { name: 'Times New Roman', size: 11, italic: true };
    ws.getCell('F5').alignment = { horizontal: 'center', vertical: 'middle' };

    // Dòng 7: Mã PO & ĐVT
    const poNum = poData.po || poData.po_number || 'PO';
    ws.getCell('A7').value = `Mã PO: ${poNum}`;
    ws.getCell('A7').font = { name: 'Times New Roman', size: 11, bold: true };
    ws.getCell('A7').alignment = { horizontal: 'left', vertical: 'middle' };

    ws.getCell('I7').value = 'ĐVT: VNĐ';
    ws.getCell('I7').font = { name: 'Times New Roman', size: 10, italic: true };
    ws.getCell('I7').alignment = { horizontal: 'right', vertical: 'middle' };

    // Dòng 8: Tiêu đề lớn
    ws.getCell('A8').value = 'NAM A BANK – ĐƠN ĐẶT HÀNG';
    ws.getCell('A8').font = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FF003366' } };
    ws.getCell('A8').alignment = { horizontal: 'center', vertical: 'middle' };

    // Dòng 9: Tên nhà cung cấp
    ws.getCell('A9').value = `Kính gửi Nhà cung cấp: ${supplierName}${supplierCode ? ` (Mã: ${supplierCode})` : ''}`;
    ws.getCell('A9').font = { name: 'Times New Roman', size: 11.5, bold: true, color: { argb: 'FF000000' } };
    ws.getCell('A9').alignment = { horizontal: 'left', vertical: 'middle' };

    // Dòng 10: Ngày phát hành
    const dateFormatted = formatExcelDate(poData.date) || formatExcelDate(new Date());
    ws.getCell('A10').value = `Ngày phát hành đơn: ${dateFormatted}`;
    ws.getCell('A10').font = { name: 'Times New Roman', size: 10.5, italic: true, color: { argb: 'FF333333' } };
    ws.getCell('A10').alignment = { horizontal: 'left', vertical: 'middle' };

    // Merge các ô phần Header
    ws.mergeCells('A2:D2');
    ws.mergeCells('A3:D3');
    ws.mergeCells('A4:D4');
    ws.mergeCells('A5:D5');
    ws.mergeCells('F1:I1');
    ws.mergeCells('F2:I2');
    ws.mergeCells('F5:I5');
    ws.mergeCells('A7:E7');
    ws.mergeCells('A8:I8');
    ws.mergeCells('A9:I9');
    ws.mergeCells('A10:E10');

    // Dòng 12: TIÊU ĐỀ 9 CỘT BẮT BUỘC THEO MỤC B
    const headerCols = [
      'STT',
      'Ngày đăng ký',
      'Tên hàng hóa',
      'SL',
      'Đơn giá',
      'Thành tiền',
      'Địa chỉ',
      'Người liên hệ',
      'Số điện thoại'
    ];

    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
    };

    const headerFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }
    };

    const row12 = ws.getRow(12);
    for (let c = 1; c <= 9; c++) {
      const cell = row12.getCell(c);
      cell.value = headerCols[c - 1];
      cell.border = thinBorder;
      cell.fill = headerFill;
      cell.font = { name: 'Times New Roman', size: 10.5, bold: true, color: { argb: 'FF003366' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }

    // 3. GHI CÁC DÒNG HÀNG HÓA THUỘC ĐÚNG NHÀ CUNG CẤP
    const supplierItems = items && items.length > 0
      ? items
      : (poData.items || []).filter(it => {
          const sup = (it.supplier || it.supplier_name || '').toLowerCase();
          const target = (supplierName || supplierCode || '').toLowerCase();
          return sup.includes(target) || target.includes(sup) || sup.includes('fti');
        });

    let currRow = 13;
    let totalQty = 0;
    let totalAmount = 0;

    supplierItems.forEach((it, idx) => {
      const row = ws.getRow(currRow);
      const q = Number(it.qty) || 1;
      const p = Number(it.price || it.unit_price) || 0;
      const amt = Number(it.amount) || (q * p);

      totalQty += q;
      totalAmount += amt;

      const unitText = it.unit || it.unit_name || '';
      const unitContact = getUnitContact(unitText);

      // Tên hàng kèm quy cách nếu có
      let itemName = it.item || it.name || it.item_name || '';
      if (it.spec && !itemName.includes(it.spec)) {
        itemName += `\n(Quy cách: ${it.spec})`;
      }

      // Ngày đăng ký của mặt hàng
      const regDate = formatExcelDate(it.date || it.request_date || poData.date) || dateFormatted;

      // Địa chỉ, đầu mối, SĐT ưu tiên lấy từ item nếu có, fallback sang unitContact
      const address = it.address || unitContact.address;
      const contactPerson = it.contact_person || it.receiver_name || unitContact.contactPerson;
      const phone = it.phone || it.contact_phone || unitContact.phone;

      const vals = [
        idx + 1,
        regDate,
        itemName,
        q,
        p,
        amt,
        address,
        contactPerson,
        phone
      ];

      for (let c = 1; c <= 9; c++) {
        const cell = row.getCell(c);
        cell.value = vals[c - 1];
        cell.border = thinBorder;
        cell.font = { name: 'Times New Roman', size: 10.5 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: [1, 2, 4, 9].includes(c) ? 'center' : [5, 6].includes(c) ? 'right' : 'left',
          wrapText: true
        };
        if ([4, 5, 6].includes(c)) {
          cell.numFmt = '#,##0';
        }
      }

      // Tự động co giãn chiều cao dòng
      const linesItem = estimateCellLines(itemName, 50);
      const linesAddr = estimateCellLines(address, 45);
      const linesContact = estimateCellLines(contactPerson, 25);
      const maxLines = Math.max(linesItem, linesAddr, linesContact, 1);
      row.height = Math.max(34, maxLines * 21 + 12);

      currRow++;
    });

    // 4. DÒNG TỔNG CỘNG CUỐI BẢNG (Theo đúng yêu cầu mục B)
    const totalRowIdx = currRow;
    const rowTotal = ws.getRow(totalRowIdx);
    for (let c = 1; c <= 9; c++) {
      rowTotal.getCell(c).border = thinBorder;
    }

    rowTotal.getCell(1).value = 'TỔNG CỘNG:';
    rowTotal.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF000000' } };
    rowTotal.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    rowTotal.getCell(4).value = totalQty;
    rowTotal.getCell(4).font = { name: 'Times New Roman', size: 11, bold: true };
    rowTotal.getCell(4).numFmt = '#,##0';
    rowTotal.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

    rowTotal.getCell(5).value = '-';
    rowTotal.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

    rowTotal.getCell(6).value = totalAmount;
    rowTotal.getCell(6).font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF000000' } };
    rowTotal.getCell(6).numFmt = '#,##0';
    rowTotal.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

    rowTotal.getCell(7).value = 'Đơn vị tiền tệ: VNĐ';
    rowTotal.getCell(7).font = { name: 'Times New Roman', size: 10.5, bold: true, italic: true };
    rowTotal.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    rowTotal.height = 30;

    ws.mergeCells(`A${totalRowIdx}:C${totalRowIdx}`);
    ws.mergeCells(`G${totalRowIdx}:I${totalRowIdx}`);
    currRow++;

    // 5. Dòng trống cách dòng
    currRow++;

    // 6. Dòng Ghi chú giao hàng
    const noteRowIdx = currRow;
    const rowNote = ws.getRow(noteRowIdx);
    rowNote.getCell(1).value = 'Ghi chú: Kính đề nghị Quý Nhà cung cấp kiểm tra đối chiếu danh mục hàng hóa, liên hệ trước với các đầu mối nhận hàng theo số điện thoại trên và cập nhật trạng thái tiến độ lên Cổng Đối tác Nam A Bank.';
    rowNote.font = { name: 'Times New Roman', size: 10, italic: true };
    rowNote.height = 24;
    ws.mergeCells(`A${noteRowIdx}:I${noteRowIdx}`);
    currRow++;

    // 7. Khu vực chữ ký
    currRow++;
    const sigHeaderRow = currRow;
    ws.getRow(sigHeaderRow).getCell(2).value = 'ĐẠI DIỆN BÊN MUA (NAM A BANK)';
    ws.getRow(sigHeaderRow).getCell(2).font = { name: 'Times New Roman', size: 11, bold: true };
    ws.getRow(sigHeaderRow).getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getRow(sigHeaderRow).getCell(7).value = 'ĐẠI DIỆN BÊN BÁN (NHÀ CUNG CẤP)';
    ws.getRow(sigHeaderRow).getCell(7).font = { name: 'Times New Roman', size: 11, bold: true };
    ws.getRow(sigHeaderRow).getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(`B${sigHeaderRow}:D${sigHeaderRow}`);
    ws.mergeCells(`G${sigHeaderRow}:I${sigHeaderRow}`);
    ws.getRow(sigHeaderRow).height = 24;

    currRow += 4; // Khoảng trống ký tên
    const sigNameRow = currRow;
    ws.getRow(sigNameRow).getCell(2).value = 'PHÒNG QUẢN TRỊ TÀI SẢN';
    ws.getRow(sigNameRow).getCell(2).font = { name: 'Times New Roman', size: 10.5, italic: true };
    ws.getRow(sigNameRow).getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getRow(sigNameRow).getCell(7).value = supplierName;
    ws.getRow(sigNameRow).getCell(7).font = { name: 'Times New Roman', size: 10.5, italic: true };
    ws.getRow(sigNameRow).getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(`B${sigNameRow}:D${sigNameRow}`);
    ws.mergeCells(`G${sigNameRow}:I${sigNameRow}`);
    ws.getRow(sigNameRow).height = 24;

    // 8. Thiết lập trang in A4 Landscape
    ws.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      printArea: `A1:I${sigNameRow + 2}`
    };

    // 9. Đồng bộ toàn bộ font thành Times New Roman
    ws.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.font) {
          cell.font = { ...cell.font, name: 'Times New Roman' };
        } else {
          cell.font = { name: 'Times New Roman', size: 11 };
        }
      });
    });

    return wb;
  },

  /**
   * Xuất file Excel đơn đặt hàng riêng cho 1 NCC và kích hoạt tải về trình duyệt
   * Tên file: PO_NAMABANK_[MA_PO]_[MA_NCC].xlsx
   */
  async exportSupplierOrderExcel({ poData, supplierCode, supplierName, items = [] }) {
    const wb = await this.generateSupplierOrderWorkbook({ poData, supplierCode, supplierName, items });
    const buffer = await wb.xlsx.writeBuffer();

    const cleanPO = String(poData.po || poData.po_number || 'PO').replace(/[/\\?%*:|"<>]/g, '_');
    const cleanNCC = String(supplierCode || 'NCC').replace(/[/\\?%*:|"<>]/g, '_');
    const fileName = `PO_NAMABANK_${cleanPO}_${cleanNCC}.xlsx`;

    triggerFileDownload(buffer, fileName);

    return { success: true, fileName, po: poData.po, supplierCode };
  }
};
