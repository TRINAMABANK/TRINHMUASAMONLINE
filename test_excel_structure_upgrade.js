import * as XLSX from 'xlsx';
import fs from 'node:fs/promises';
import { excelExporter } from './src/services/excelExporter.js';

async function run() {
  console.log('================================================================');
  console.log('KIỂM THỬ NÂNG CẤP CẤU TRÚC FILE EXCEL XUẤT PHIẾU TRÌNH KÝ');
  console.log('================================================================\n');

  // Đọc file mẫu
  const tplBuf1 = (await fs.readFile('public/templates/1_BANG_TRINH_KY.xlsx')).buffer;
  const tplBuf2 = (await fs.readFile('public/templates/2_BANG_KE.xlsx')).buffer;

  // Đọc file thô 45 dòng
  const phieuThoBuffer = await fs.readFile('test_files/PHIEU_THO.xlsx');
  const wbRaw = XLSX.read(phieuThoBuffer, { type: 'buffer', cellDates: true, raw: true });
  const sheet = wbRaw.Sheets[wbRaw.SheetNames[0]];
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
      payGroup: null,
      selected: true
    };
  }).filter(r => r.item.length > 0);

  console.log(`Đã nạp ${items.length} dòng hàng hóa từ file thô.`);

  // Phân loại: 10 dòng đầu là HOI_SO (Nhóm I), 35 dòng còn lại là DON_VI (Nhóm II)
  for (let i = 0; i < 10; i++) items[i].payGroup = 'HOI_SO';
  for (let i = 10; i < items.length; i++) items[i].payGroup = 'DON_VI';

  const poData = {
    po: 'PO-2026-00048',
    title: 'Trang bị mua sắm Các tài sản cố định/Công cụ lao động cho đơn vị',
    date: '2026-11-07',
    items: items
  };

  const wb = await excelExporter.generateSingleProcurementWorkbook(poData, tplBuf1, tplBuf2);
  const outBuf = await wb.xlsx.writeBuffer();

  await fs.mkdir('test_output', { recursive: true });
  const outPath = 'test_output/HO_SO_TRINH_KY_UPGRADE.xlsx';
  await fs.writeFile(outPath, Buffer.from(outBuf));

  console.log(`Đã xuất file thành công: ${outPath} (${outBuf.byteLength} bytes)`);
}

run().catch(err => {
  console.error('LỖI KIỂM THỬ:', err);
  process.exit(1);
});
