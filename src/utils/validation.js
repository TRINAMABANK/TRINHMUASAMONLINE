/**
 * Utility xác thực dữ liệu và chuẩn hóa tìm kiếm
 */

/**
 * Loại bỏ dấu tiếng Việt và chuyển sang chữ thường để tìm kiếm linh hoạt
 * @param {string} str 
 * @returns {string}
 */
export function normalizeText(str) {
  return String(str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim();
}

/**
 * Rà soát và cảnh báo tính hợp lệ của dòng dữ liệu
 * @param {object} row 
 * @param {number} index 
 * @returns {string[]} Danh sách các cảnh báo (nếu có)
 */
export function validateRow(row, index) {
  const warnings = [];
  const lineNo = index + 1;

  if (!row.item || !String(row.item).trim()) {
    warnings.push(`Dòng ${lineNo}: Thiếu tên hàng hóa/nội dung`);
  }
  if (!row.qty || Number(row.qty) <= 0) {
    warnings.push(`Dòng ${lineNo}: Thiếu số lượng hoặc SL ≤ 0`);
  }
  if (!row.unit || !String(row.unit).trim()) {
    warnings.push(`Dòng ${lineNo}: Chưa có tên đơn vị`);
  }
  if (row.price === undefined || row.price === null || Number(row.price) < 0) {
    warnings.push(`Dòng ${lineNo}: Đơn giá không hợp lệ`);
  }
  if (!row.amount && row.qty && row.price) {
    warnings.push(`Dòng ${lineNo}: Chưa tính thành tiền`);
  }

  return warnings;
}

/**
 * Tự động tìm mã MSP trong text (nếu có)
 * Ví dụ: "MSP:801BNPT20260425113035" -> "801BNPT20260425113035"
 */
export function extractMSP(text) {
  if (!text) return '';
  const match = String(text).match(/MSP\s*:\s*([A-Za-z0-9_-]+)/i);
  return match ? match[1].trim() : '';
}
