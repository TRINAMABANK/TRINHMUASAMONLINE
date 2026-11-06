import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import fs from 'node:fs/promises';
import path from 'node:path';
import { excelExporter, categorizePayGroups } from './src/services/excelExporter.js';

async function run() {
  console.log('--- BẮT ĐẦU KIỂM THỬ XUẤT 01 FILE EXCEL GỒM 02 SHEET VỚI FILE THỰC TẾ ---');

  // 1. Đọc file PHIEU_THO.xlsx thực tế
  const phieuThoBuffer = await fs.readFile('test_files/PHIEU_THO.xlsx');
  const wb = XLSX.read(phieuThoBuffer, { type: 'buffer', cellDates: true, raw: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });

  console.log(`Đã đọc sheet: "${sheetName}", tổng số dòng thô: ${rawRows.length}`);

  // Tìm header
  const headerIdx = rawRows.findIndex(r => Array.isArray(r) && r.filter(v => String(v).trim().length > 0).length >= 2);
  const headers = rawRows[headerIdx];
  console.log('Headers:', headers);

  // Parse các dòng dữ liệu
  const items = [];
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.length === 0 || !r.some(v => String(v).trim().length > 0)) continue;

    const unit = String(r[2] || '').trim();
    const item = String(r[4] || '').trim();
    if (!item) continue;

    const qty = Number(r[5]) || 1;
    const price = Number(r[7]) || 0;
    const amount = Number(r[8]) || (qty * price);
    const purpose = String(r[9] || '').trim();
    const supplier = String(r[3] || '').trim();
    const date = r[1] ? new Date(r[1]).toLocaleDateString('vi-VN') : '07/11/2026';

    // Nhóm TT: Nếu đơn vị có 'hội sở' / 'khối' / 'ban' / 'trung tâm' => Nhóm A, còn lại => Nhóm B
    // Để kiểm thử cả 2 nhóm, chúng ta phân bổ: 4 dòng đầu là Nhóm A (Hội sở), các dòng sau là Nhóm B (Đơn vị)
    const isGroupA = (items.length < 4) || unit.toLowerCase().includes('hội sở');
    const payGroup = isGroupA ? 'A' : 'B';

    items.push({
      stt: items.length + 1,
      date,
      unit: isGroupA ? (unit.includes('Hội sở') ? unit : `Hội sở - ${unit}`) : unit,
      supplier,
      item,
      qty,
      spec: String(r[6] || 'CÁI').trim(),
      price,
      amount,
      purpose,
      msp: '',
      payGroup,
      selected: true
    });
  }

  console.log(`Đã phân tích được ${items.length} dòng hàng hóa hợp lệ.`);
  const groups = categorizePayGroups(items);
  console.log(`- Nhóm A (Hội sở thanh toán): ${groups.itemsA.length} dòng`);
  console.log(`- Nhóm B (Đơn vị thanh toán): ${groups.itemsB.length} dòng`);

  const poData = {
    po: 'PO-2026-00001',
    date: '2026-11-07',
    requester: 'Nguyễn Văn A - Cán bộ QTTS Nam A Bank',
    note: 'Hồ sơ trang bị thiết bị và công cụ làm việc quý 4/2026',
    items: items
  };

  // Nạp 2 template buffer
  const tplBuf1 = (await fs.readFile('public/templates/1_BANG_TRINH_KY.xlsx')).buffer;
  const tplBuf2 = (await fs.readFile('public/templates/2_BANG_KE.xlsx')).buffer;

  // Gọi service xuất duy nhất 01 file Excel gồm 02 sheet
  const exportedWb = await excelExporter.generateSingleProcurementWorkbook(poData, {
    customTemplateBuffer1: tplBuf1,
    customTemplateBuffer2: tplBuf2
  });

  await fs.mkdir('test_output', { recursive: true });
  const outputPath = 'test_output/PO-2026-00001_Ho_so_mua_sam_THUC_TE.xlsx';
  await exportedWb.xlsx.writeFile(outputPath);

  console.log(`ĐÃ XUẤT THÀNH CÔNG 01 FILE EXCEL DUY NHẤT: ${outputPath}`);
}

run().catch(err => {
  console.error('LỖI KIỂM THỬ:', err);
  process.exit(1);
});
