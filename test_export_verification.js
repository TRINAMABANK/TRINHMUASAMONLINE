import { excelExporter } from './src/services/excelExporter.js';
import fs from 'node:fs/promises';
import path from 'node:path';

// Tạo thư mục output kiểm thử
await fs.mkdir('test_output', { recursive: true });

// Bộ dữ liệu test 1 dòng
const testCase1 = {
  id: 'test_1',
  po: 'PO-2026-00001',
  date: '2026-11-06',
  items: [
    {
      stt: 1,
      date: '06/11/2026',
      unit: 'Chi Nhánh Hà Nội',
      supplier: 'Công ty Viễn Thông Quốc Tế FTI',
      item: 'MÁY IN LASER BROTHER HL-L6210DW CÔNG SUẤT CAO CHO PHÒNG KẾ TOÁN',
      qty: 2,
      spec: 'CÁI',
      price: 10315000,
      amount: 20630000,
      purpose: 'Trang bị mới phục vụ in báo cáo cuối năm, thay thế máy HP 402 cũ bị hỏng; MSP:801BNPT20261106',
      selected: true
    }
  ]
};

// Bộ dữ liệu test 5 dòng
const testCase5 = {
  id: 'test_5',
  po: 'PO-2026-00005',
  date: '2026-11-06',
  items: Array.from({ length: 5 }, (_, i) => ({
    stt: i + 1,
    date: '06/11/2026',
    unit: `Chi nhánh KV ${i + 1}`,
    supplier: 'Nhà cung cấp FPT Telecom',
    item: `CPU LENOVO ThinkCentre Neo 50s Gen 6 U3 Ram 16GB SSD 512GB (Dòng ${i + 1})`,
    qty: 1,
    spec: 'BỘ',
    price: 26811000,
    amount: 26811000,
    purpose: `Trang bị máy tính làm việc cho CBNV số ${i + 1}`,
    selected: true
  }))
};

// Bộ dữ liệu test 20 dòng
const testCase20 = {
  id: 'test_20',
  po: 'PO-2026-00020',
  date: '2026-11-06',
  items: Array.from({ length: 20 }, (_, i) => ({
    stt: i + 1,
    date: '06/11/2026',
    unit: `Đơn vị kinh doanh số ${i + 1} - Nam Á Bank`,
    supplier: i % 2 === 0 ? 'CTY FTI' : 'HANG TIN',
    item: `Thiết bị kiểm ngân & máy tính cao cấp mã hiệu TK-${1000 + i}`,
    qty: (i % 3) + 1,
    spec: 'CÁI',
    price: 15500000 * (i + 1),
    amount: ((i % 3) + 1) * 15500000 * (i + 1),
    purpose: `Phục vụ công tác thanh toán & chuyển đổi số 2026; MSP:808BNPT${Date.now() + i}`,
    selected: true
  }))
};

console.log('--- ĐANG KIỂM THỬ XUẤT EXCEL TỰ ĐỘNG ---');

const tplBuf1 = (await fs.readFile('public/templates/1_BANG_TRINH_KY.xlsx')).buffer;
const tplBuf2 = (await fs.readFile('public/templates/2_BANG_KE.xlsx')).buffer;

async function runTestCase(testData, label) {
  console.log(`\n[Kiểm thử ${label}]: ${testData.items.length} dòng`);
  
  // 1. Xuất Bảng trình ký
  const wb1 = await excelExporter.generateBangTrinhKy(testData, tplBuf1);
  const buf1 = await wb1.xlsx.writeBuffer();
  const file1 = path.join('test_output', `${testData.po}_01_Bang_trinh_ky.xlsx`);
  await fs.writeFile(file1, Buffer.from(buf1));
  console.log(`  -> Đã tạo Bảng trình ký: ${file1} (${buf1.byteLength} bytes)`);

  // 2. Xuất Bảng kê
  const wb2 = await excelExporter.generateBangKe(testData, tplBuf2);
  const buf2 = await wb2.xlsx.writeBuffer();
  const file2 = path.join('test_output', `${testData.po}_02_Bang_ke.xlsx`);
  await fs.writeFile(file2, Buffer.from(buf2));
  console.log(`  -> Đã tạo Bảng kê: ${file2} (${buf2.byteLength} bytes)`);
}

await runTestCase(testCase1, '1 dòng');
await runTestCase(testCase5, '5 dòng');
await runTestCase(testCase20, '20 dòng');

console.log('\nHoàn thành xuất toàn bộ file kiểm thử!');
