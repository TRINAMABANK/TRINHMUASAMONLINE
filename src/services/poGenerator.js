/**
 * Service sinh mã PO tự động & duy nhất cho hệ thống QTTS
 * Định dạng: PO-YYYY-XXXXX (ví dụ: PO-2026-00001)
 */

const PO_COUNTER_KEY = 'qtts_po_counter';

let inMemoryCounter = 0;

/**
 * Lấy số counter hiện tại từ localStorage (hoặc bộ nhớ tạm nếu ở Node)
 * @returns {number}
 */
export function getCurrentCounter() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(PO_COUNTER_KEY);
    const n = Number(saved);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return inMemoryCounter;
}

/**
 * Lưu counter
 */
function setCounter(val) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PO_COUNTER_KEY, String(val));
  } else {
    inMemoryCounter = val;
  }
}

/**
 * Sinh mã PO tiếp theo theo định dạng chuẩn: PO-2026-00001
 * Đảm bảo:
 * 1. Không trùng lặp
 * 2. Tăng dần số thứ tự 5 chữ số
 * 3. Tự động lấy năm hiện tại (2026)
 * @param {Array} existingPOs Danh sách các PO hiện có để kiểm tra trùng lặp
 * @returns {string}
 */
export function generateNextPONumber(existingPOs = []) {
  let counter = getCurrentCounter();
  const currentYear = new Date().getFullYear();
  let nextPO = '';
  let isUnique = false;

  // Lấy danh sách các mã PO đã tồn tại (dạng chữ hoa)
  const existingSet = new Set(
    (existingPOs || []).map(p => (typeof p === 'string' ? p : p.po || '').trim().toUpperCase())
  );

  while (!isUnique) {
    counter += 1;
    nextPO = `PO-${currentYear}-${String(counter).padStart(5, '0')}`;
    if (!existingSet.has(nextPO.toUpperCase())) {
      isUnique = true;
    }
  }

  // Cập nhật counter mới vào localStorage
  setCounter(counter);
  return nextPO;
}

/**
 * Reset counter (chỉ dùng cho cài đặt hoặc kiểm thử)
 */
export function resetPOCounter(val = 0) {
  setCounter(val);
}
