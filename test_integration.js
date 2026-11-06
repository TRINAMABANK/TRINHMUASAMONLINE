import { excelReader } from './src/services/excelReader.js';
import { excelExporter } from './src/services/excelExporter.js';
import { generateNextPONumber } from './src/services/poGenerator.js';
import fs from 'node:fs/promises';
import path from 'node:path';

console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP TỰ ĐỘNG ĐỌC VÀ XUẤT PHIẾU THÔ ===');

// 1. Đọc file phiếu thô thật
const sampleBuffer = await fs.readFile('test_files/PHIEU_THO.xlsx');
const mockFile = {
  name: 'PHIEU_THO.xlsx',
  arrayBuffer: async () => sampleBuffer.buffer.slice(sampleBuffer.byteOffset, sampleBuffer.byteOffset + sampleBuffer.byteLength)
};

const parsedResult = await excelReader.readExcelFile(mockFile);
console.log(`1. Đọc thành công file: ${parsedResult.fileName}`);
console.log(`   - Tổng dòng hợp lệ: ${parsedResult.validRowsCount}`);
console.log(`   - Dòng 1 STT=${parsedResult.rows[0].stt}, Tên=${parsedResult.rows[0].item.substring(0, 30)}...`);
console.log(`   - Dòng 1 Đơn giá=${parsedResult.rows[0].price.toLocaleString('vi-VN')} đ, SL=${parsedResult.rows[0].qty}`);

// 2. Thử nghiệm chọn 10 dòng bất kỳ để tạo PO
const chosenRows = parsedResult.rows.slice(0, 10);
const nextPO = generateNextPONumber([]);
console.log(`2. Sinh mã PO tự động: ${nextPO}`);

const poRecord = {
  id: 'test_integration_po',
  po: nextPO,
  date: '2026-11-06',
  requester: 'Quang Nhựt Trí - Chuyên viên QTTS',
  payGroup: 'A',
  note: 'Hồ sơ trang bị tài sản thử nghiệm tích hợp',
  items: chosenRows
};

// 3. Xuất 2 file Excel
console.log('3. Xuất 2 file Excel từ 10 dòng đã chọn...');
const tplBuf1 = (await fs.readFile('public/templates/1_BANG_TRINH_KY.xlsx')).buffer;
const tplBuf2 = (await fs.readFile('public/templates/2_BANG_KE.xlsx')).buffer;

const wb1 = await excelExporter.generateBangTrinhKy(poRecord, tplBuf1);
const buf1 = await wb1.xlsx.writeBuffer();
const out1 = path.join('test_output', `${nextPO}_01_Bang_trinh_ky.xlsx`);
await fs.writeFile(out1, Buffer.from(buf1));

const wb2 = await excelExporter.generateBangKe(poRecord, tplBuf2);
const buf2 = await wb2.xlsx.writeBuffer();
const out2 = path.join('test_output', `${nextPO}_02_Bang_ke.xlsx`);
await fs.writeFile(out2, Buffer.from(buf2));

console.log(`   -> File 1: ${out1} (${buf1.byteLength} bytes)`);
console.log(`   -> File 2: ${out2} (${buf2.byteLength} bytes)`);
console.log('=== KIỂM THỬ TÍCH HỢP HOÀN TOÀN THÀNH CÔNG! ===');
