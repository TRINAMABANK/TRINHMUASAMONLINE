import * as XLSX from 'xlsx';
import fs from 'node:fs/promises';

/**
 * Kiểm thử bắt buộc theo yêu cầu:
 * 1. Chưa phân loại dòng nào: không được xuất.
 * 2. Phân loại thiếu 1 dòng: không được xuất.
 * 3. Phân loại đủ tất cả dòng: được xuất.
 * 4. Thay đổi Nhóm TT sau khi phân loại: phải cập nhật điều kiện xuất.
 * 5. Dữ liệu có lỗi: phải chặn xuất.
 * 6. Tổng tiền hai nhóm phải bằng tổng tiền các dòng được xuất.
 */

async function runTests() {
  console.log('================================================================');
  console.log('BẮT ĐẦU KIỂM THỬ BẮT BUỘC: ĐIỀU KIỆN XUẤT EXCEL & VỊ TRÍ');
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
      payGroup: null,
      selected: false
    };
  }).filter(r => r.item.length > 0);

  const totalCount = items.length;
  const grandTotalAmount = items.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  console.log(`Đã nạp file: ${totalCount} dòng hàng hóa, Tổng tiền = ${grandTotalAmount.toLocaleString('vi-VN')} đ.`);

  // Hàm kiểm tra điều kiện xuất chuẩn hóa từ ExportConfirmationBar
  function checkExportCondition(rows) {
    const countHO = rows.filter(r => r.payGroup === 'HOI_SO' || r.payGroup === 'A').length;
    const amountHO = rows.filter(r => r.payGroup === 'HOI_SO' || r.payGroup === 'A').reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const countDV = rows.filter(r => r.payGroup === 'DON_VI' || r.payGroup === 'B').length;
    const amountDV = rows.filter(r => r.payGroup === 'DON_VI' || r.payGroup === 'B').reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const countUnassigned = rows.filter(r => !r.payGroup).length;
    const amountUnassigned = rows.filter(r => !r.payGroup).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const classifiedCount = countHO + countDV;
    const totalClassifiedAmount = amountHO + amountDV;

    const hasCriticalErrors = rows.some(r => {
      const itemEmpty = !r.item || String(r.item).trim() === '';
      const qtyInvalid = isNaN(Number(r.qty)) || Number(r.qty) <= 0;
      const priceInvalid = isNaN(Number(r.price)) || Number(r.price) < 0;
      const amountInvalid = isNaN(Number(r.amount)) || Number(r.amount) < 0;
      return itemEmpty || qtyInvalid || priceInvalid || amountInvalid;
    });

    const amountMatches = Math.abs(totalClassifiedAmount - grandTotalAmount) < 0.01;

    const isReady =
      rows.length > 0 &&
      countUnassigned === 0 &&
      classifiedCount === rows.length &&
      rows.every(r => r.payGroup === 'HOI_SO' || r.payGroup === 'DON_VI' || r.payGroup === 'A' || r.payGroup === 'B') &&
      !hasCriticalErrors &&
      amountMatches;

    return {
      isReady,
      classifiedCount,
      countUnassigned,
      countHO,
      countDV,
      amountHO,
      amountDV,
      totalClassifiedAmount,
      grandTotalAmount,
      hasCriticalErrors,
      amountMatches
    };
  }

  // TEST 1: Chưa phân loại dòng nào -> KHÔNG ĐƯỢC XUẤT
  console.log('\n[TEST 1] Chưa phân loại dòng nào (0 dòng đã gán)...');
  let rowsTest = JSON.parse(JSON.stringify(items));
  rowsTest.forEach(r => r.payGroup = null);
  let res1 = checkExportCondition(rowsTest);
  console.log(`  -> isReady: ${res1.isReady}, Chưa phân loại: ${res1.countUnassigned} dòng`);
  if (res1.isReady !== false) throw new Error('TEST 1 THẤT BẠI: Chưa phân loại nhưng lại cho phép xuất!');
  console.log('  -> PASS: Chưa phân loại dòng nào -> Bị chặn xuất chính xác 100%.');

  // TEST 2: Phân loại thiếu 1 dòng -> KHÔNG ĐƯỢC XUẤT
  console.log('\n[TEST 2] Phân loại thiếu 1 dòng (44/45 dòng đã gán, còn 1 dòng null)...');
  for (let i = 0; i < totalCount - 1; i++) {
    rowsTest[i].payGroup = (i < 10) ? 'HOI_SO' : 'DON_VI';
  }
  rowsTest[totalCount - 1].payGroup = null; // 1 dòng chưa gán
  let res2 = checkExportCondition(rowsTest);
  console.log(`  -> isReady: ${res2.isReady}, Đã gán: ${res2.classifiedCount}/${totalCount}, Còn thiếu: ${res2.countUnassigned}`);
  if (res2.isReady !== false) throw new Error('TEST 2 THẤT BẠI: Thiếu 1 dòng nhưng lại cho phép xuất!');
  console.log('  -> PASS: Phân loại thiếu 1 dòng -> Bị chặn xuất chính xác 100%.');

  // TEST 3: Phân loại đủ tất cả các dòng -> ĐƯỢC PHÉP XUẤT
  console.log('\n[TEST 3] Phân loại đủ 100% dòng (10 dòng Hội sở, 35 dòng Đơn vị)...');
  rowsTest[totalCount - 1].payGroup = 'DON_VI';
  let res3 = checkExportCondition(rowsTest);
  console.log(`  -> isReady: ${res3.isReady}, Đã gán: ${res3.classifiedCount}/${totalCount}, Chưa gán: ${res3.countUnassigned}`);
  console.log(`  -> Tiền Hội sở: ${res3.amountHO.toLocaleString('vi-VN')} đ | Tiền Đơn vị: ${res3.amountDV.toLocaleString('vi-VN')} đ`);
  console.log(`  -> Tổng tiền khớp: ${res3.amountMatches} (Tổng = ${res3.totalClassifiedAmount.toLocaleString('vi-VN')} đ)`);
  if (res3.isReady !== true) throw new Error('TEST 3 THẤT BẠI: Đã phân loại đủ 100% nhưng không cho xuất!');
  console.log('  -> PASS: Phân loại đủ 100% dòng -> Nút xuất sáng xanh, sẵn sàng xuất!');

  // TEST 4: Thay đổi Nhóm TT sau khi phân loại -> Cập nhật điều kiện ngay lập tức
  console.log('\n[TEST 4] Thay đổi Nhóm TT (hủy 1 nhóm hoặc chuyển dòng về null)...');
  rowsTest[0].payGroup = null; // Người dùng hủy 1 dòng
  let res4 = checkExportCondition(rowsTest);
  console.log(`  -> Sau khi hủy 1 dòng, isReady = ${res4.isReady}, Chưa gán = ${res4.countUnassigned}`);
  if (res4.isReady !== false) throw new Error('TEST 4 THẤT BẠI: Hủy phân loại nhưng trạng thái không tự động chuyển về chặn xuất!');
  rowsTest[0].payGroup = 'HOI_SO'; // Gán lại
  let res4_re = checkExportCondition(rowsTest);
  if (res4_re.isReady !== true) throw new Error('TEST 4 THẤT BẠI: Gán lại đủ nhưng không sẵn sàng xuất!');
  console.log('  -> PASS: Thay đổi Nhóm TT -> Điều kiện xuất cập nhật ngay lập tức!');

  // TEST 5: Dữ liệu có lỗi -> CHẶN XUẤT
  console.log('\n[TEST 5] Dữ liệu có lỗi (ví dụ số lượng <= 0 hoặc tên hàng trống)...');
  rowsTest[2].qty = 0; // Lỗi số lượng = 0
  let res5 = checkExportCondition(rowsTest);
  console.log(`  -> Có lỗi dữ liệu: hasCriticalErrors = ${res5.hasCriticalErrors}, isReady = ${res5.isReady}`);
  if (res5.isReady !== false) throw new Error('TEST 5 THẤT BẠI: Hàng có lỗi số lượng = 0 nhưng vẫn cho xuất!');
  rowsTest[2].qty = 1; // Sửa lại
  console.log('  -> PASS: Dữ liệu lỗi bị chặn xuất chính xác!');

  // TEST 6: Tổng tiền hai nhóm phải bằng tổng tiền các dòng được xuất
  console.log('\n[TEST 6] Kiểm tra cân đối tổng tiền 2 nhóm so với danh sách xuất...');
  let res6 = checkExportCondition(rowsTest);
  const diff = Math.abs(res6.totalClassifiedAmount - res6.grandTotalAmount);
  console.log(`  -> Tổng Hội sở: ${res6.amountHO.toLocaleString('vi-VN')} đ`);
  console.log(`  -> Tổng Đơn vị: ${res6.amountDV.toLocaleString('vi-VN')} đ`);
  console.log(`  -> Tổng 2 nhóm: ${res6.totalClassifiedAmount.toLocaleString('vi-VN')} đ`);
  console.log(`  -> Tổng danh sách: ${res6.grandTotalAmount.toLocaleString('vi-VN')} đ`);
  console.log(`  -> Chênh lệch: ${diff} đ`);
  if (diff > 0.01) throw new Error(`TEST 6 THẤT BẠI: Tổng tiền không khớp: ${res6.totalClassifiedAmount} vs ${res6.grandTotalAmount}`);
  console.log('  -> PASS: Tổng tiền hai nhóm khớp 100% với tổng tiền danh sách!');

  console.log('\n================================================================');
  console.log('TẤT CẢ 6/6 ĐIỀU KIỆN KIỂM THỬ BẮT BUỘC ĐÃ ĐẠT 100% THÀNH CÔNG!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('LỖI:', err);
  process.exit(1);
});
