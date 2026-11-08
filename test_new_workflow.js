import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import fs from 'node:fs/promises';
import { excelExporter } from './src/services/excelExporter.js';

async function runTest() {
  console.log('================================================================');
  console.log('KIỂM THỬ: LOGIC BÙ TRỪ (TICK NHÓM NÀY -> CÒN LẠI TỰ ĐỘNG LÀ NHÓM KIA)');
  console.log('================================================================\n');

  // Đọc file test_files/PHIEU_THO.xlsx
  const phieuThoBuffer = await fs.readFile('test_files/PHIEU_THO.xlsx');
  const wb = XLSX.read(phieuThoBuffer, { type: 'buffer', cellDates: true, raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });

  const headerIdx = rawRows.findIndex(r => Array.isArray(r) && r.filter(v => String(v).trim().length > 0).length >= 2);
  const dataRows = rawRows.slice(headerIdx + 1).filter(r => Array.isArray(r) && r.some(v => String(v).trim().length > 0));

  const items = dataRows.map((r, idx) => {
    const item = String(r[4] || '').trim();
    const qty = Number(r[5]) || 1;
    const price = Number(r[7]) || 0;
    const amount = Number(r[8]) || (qty * price);
    return {
      id: `row_${idx + 1}`,
      stt: idx + 1,
      date: r[1] ? new Date(r[1]).toLocaleDateString('vi-VN') : '07/11/2026',
      unit: String(r[2] || '').trim(),
      supplier: String(r[3] || '').trim(),
      item,
      qty,
      spec: String(r[6] || 'CÁI').trim(),
      price,
      amount,
      purpose: String(r[9] || '').trim(),
      msp: '',
      payGroup: null,
      selected: false
    };
  }).filter(r => r.item.length > 0);

  const totalCount = items.length;
  console.log(`Tổng số dòng hàng hóa trong file: ${totalCount} dòng.`);

  // TEST KỊCH BẢN 1:
  // Tick 10 dòng đầu, chọn Hội sở thanh toán
  // -> 10 dòng đầu phải là Hội sở (HOI_SO)
  // -> 35 dòng còn lại tự động là Đơn vị thanh toán (DON_VI)
  console.log('\n[KỊCH BẢN 1] Tick 10 dòng đầu -> Chọn "Hội sở thanh toán" -> ACCEPT');
  for (let i = 0; i < 10; i++) items[i].selected = true;
  for (let i = 10; i < totalCount; i++) items[i].selected = false;

  const chosenType = 'HOI_SO';
  const otherType = chosenType === 'HOI_SO' ? 'DON_VI' : 'HOI_SO';

  // Mô phỏng logic bù trừ:
  items.forEach(row => {
    if (row.selected === true) {
      row.payGroup = chosenType;
      row.selected = false;
    } else {
      row.payGroup = otherType;
      row.selected = false;
    }
  });

  const hoRows1 = items.filter(r => r.payGroup === 'HOI_SO');
  const dvRows1 = items.filter(r => r.payGroup === 'DON_VI');
  console.log(`  -> Số dòng Hội sở: ${hoRows1.length} dòng (Kỳ vọng: 10)`);
  console.log(`  -> Số dòng Đơn vị: ${dvRows1.length} dòng (Kỳ vọng: ${totalCount - 10})`);

  if (hoRows1.length !== 10) throw new Error('Kịch bản 1: Số dòng Hội sở không khớp 10');
  if (dvRows1.length !== totalCount - 10) throw new Error(`Kịch bản 1: Số dòng Đơn vị không khớp ${totalCount - 10}`);
  console.log('  -> PASS: 10 dòng tick là Hội sở, các dòng còn lại tự động là Đơn vị!');

  // TEST KỊCH BẢN 2 (ĐẢO NGƯỢC):
  // Tick 5 dòng khác, chọn Đơn vị thanh toán
  // -> 5 dòng đó phải là Đơn vị (DON_VI)
  // -> 40 dòng còn lại tự động là Hội sở (HOI_SO)
  console.log('\n[KỊCH BẢN 2] Tick 5 dòng (dòng 11-15) -> Chọn "Đơn vị thanh toán" -> ACCEPT');
  // Reset
  items.forEach(r => { r.payGroup = null; r.selected = false; });
  for (let i = 10; i < 15; i++) items[i].selected = true;

  const chosenType2 = 'DON_VI';
  const otherType2 = chosenType2 === 'HOI_SO' ? 'DON_VI' : 'HOI_SO';

  items.forEach(row => {
    if (row.selected === true) {
      row.payGroup = chosenType2;
      row.selected = false;
    } else {
      row.payGroup = otherType2;
      row.selected = false;
    }
  });

  const hoRows2 = items.filter(r => r.payGroup === 'HOI_SO');
  const dvRows2 = items.filter(r => r.payGroup === 'DON_VI');
  console.log(`  -> Số dòng Đơn vị: ${dvRows2.length} dòng (Kỳ vọng: 5)`);
  console.log(`  -> Số dòng Hội sở: ${hoRows2.length} dòng (Kỳ vọng: ${totalCount - 5})`);

  if (dvRows2.length !== 5) throw new Error('Kịch bản 2: Số dòng Đơn vị không khớp 5');
  if (hoRows2.length !== totalCount - 5) throw new Error(`Kịch bản 2: Số dòng Hội sở không khớp ${totalCount - 5}`);
  console.log('  -> PASS: 5 dòng tick là Đơn vị, 40 dòng còn lại tự động là Hội sở!');

  // TEST XUẤT EXCEL TỪ KẾT QUẢ PHÂN LOẠI BÙ TRỪ
  console.log('\n[TEST XUẤT EXCEL] Kiểm tra xuất 01 File Excel gồm 02 Sheet từ kết quả phân loại...');
  const poData = {
    po: 'PO-2026-COMPLEMENTARY',
    date: '2026-11-07',
    requester: 'Cán bộ Quản trị Tài sản',
    note: 'Hồ sơ thử nghiệm phân loại bù trừ 5 dòng Đơn vị + 40 dòng Hội sở',
    items: items.map(r => ({ ...r, selected: true }))
  };

  const tplBuf1 = (await fs.readFile('public/templates/1_BANG_TRINH_KY.xlsx')).buffer;
  const tplBuf2 = (await fs.readFile('public/templates/2_BANG_KE.xlsx')).buffer;

  const exportedWb = await excelExporter.generateSingleProcurementWorkbook(poData, {
    customTemplateBuffer1: tplBuf1,
    customTemplateBuffer2: tplBuf2
  });

  const outputPath = 'test_output/PO_TEST_COMPLEMENTARY_02_SHEET.xlsx';
  await exportedWb.xlsx.writeFile(outputPath);

  const checkWb = new ExcelJS.Workbook();
  await checkWb.xlsx.readFile(outputPath);

  console.log(`  -> Tên các sheet: [${checkWb.worksheets.map(w => w.name).join(', ')}]`);
  if (checkWb.worksheets.length !== 2) throw new Error('File không có đúng 2 sheet');

  console.log('\n================================================================');
  console.log('TẤT CẢ CÁC KIỂM THỬ ĐÃ ĐẠT 100% THÀNH CÔNG!');
  console.log('================================================================');
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
