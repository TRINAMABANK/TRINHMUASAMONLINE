/**
 * Utility xử lý tiền tệ và số học chuẩn xác cho hệ thống QTTS
 */

/**
 * Phân tích và chuyển đổi giá trị bất kỳ từ Excel / người dùng nhập thành số chính xác
 * Không làm sai lệch giá trị, hỗ trợ cả 10.000.000 lẫn 10,000,000.00
 * @param {any} v 
 * @returns {number}
 */
export function parseCurrency(v) {
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : 0;
  }
  if (v === null || v === undefined) return 0;
  
  let s = String(v).trim();
  if (s === '') return 0;

  // Xóa các ký tự không phải số, dấu phẩy, dấu chấm, dấu trừ
  s = s.replace(/[^\d,.-]/g, '');

  // Xử lý trường hợp cả dấu chấm và dấu phẩy: ví dụ 10.000,50 hoặc 10,000.50
  if (s.includes('.') && s.includes(',')) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Dạng Việt Nam: 10.000.000,50
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Dạng Quốc tế: 10,000,000.50
      s = s.replace(/,/g, '');
    }
  } else if ((s.match(/\./g) || []).length > 1) {
    // Nhiều dấu chấm: 10.000.000
    s = s.replace(/\./g, '');
  } else if ((s.match(/,/g) || []).length > 1) {
    // Nhiều dấu phẩy: 10,000,000
    s = s.replace(/,/g, '');
  } else if (s.includes(',') && !s.includes('.')) {
    // Chỉ có 1 dấu phẩy: nếu sau dấu phẩy là 3 chữ số thì khả năng là phân cách hàng nghìn (10,000)
    // Nếu sau dấu phẩy là 1-2 chữ số thì là số thập phân (10,5)
    const parts = s.split(',');
    if (parts[1].length === 3) {
      s = s.replace(',', '');
    } else {
      s = s.replace(',', '.');
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Định dạng số thành chuỗi phân cách hàng nghìn kiểu Việt Nam
 * @param {number|string} n 
 * @returns {string} ví dụ "10.315.000"
 */
export function formatNumber(n) {
  const num = typeof n === 'number' ? n : parseCurrency(n);
  return new Intl.NumberFormat('vi-VN').format(num);
}

/**
 * Định dạng tiền tệ kèm đơn vị "đ"
 * @param {number|string} n 
 * @returns {string} ví dụ "10.315.000 đ"
 */
export function formatCurrency(n) {
  return `${formatNumber(n)} đ`;
}
