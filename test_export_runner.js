import fs from 'fs';
import { excelReader } from './src/services/excelReader.js';
import { excelExporter } from './src/services/excelExporter.js';

async function testExport() {
  const buf = fs.readFileSync('test_files/PHIEU_THO.xlsx');
  const file = {
    name: 'PHIEU_THO.xlsx',
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  };
  const result = await excelReader.readExcelFile(file);
  
  // Classify rows as user would
  const rows = result.rows.map((r, i) => ({
    ...r,
    payGroup: i < 5 ? 'HOI_SO' : 'DON_VI',
    selected: true
  }));

  const tplBuf1 = fs.readFileSync('public/templates/1_BANG_TRINH_KY.xlsx');
  const tplBuf2 = fs.readFileSync('public/templates/2_BANG_KE.xlsx');

  const poData = {
    po: 'PO-2026-TEST',
    date: '2026-11-08',
    requester: 'Người dùng test',
    items: rows
  };

  const wb = await excelExporter.generateSingleProcurementWorkbook(
    poData,
    tplBuf1.buffer.slice(tplBuf1.byteOffset, tplBuf1.byteOffset + tplBuf1.byteLength),
    tplBuf2.buffer.slice(tplBuf2.byteOffset, tplBuf2.byteOffset + tplBuf2.byteLength)
  );

  const outBuf = await wb.xlsx.writeBuffer();
  fs.writeFileSync('test_output/TEST_GENERATED.xlsx', Buffer.from(outBuf));
  console.log('Successfully written test_output/TEST_GENERATED.xlsx');
}

testExport().catch(console.error);
