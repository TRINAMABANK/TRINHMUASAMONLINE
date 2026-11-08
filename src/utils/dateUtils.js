/**
 * Utility xử lý ngày tháng chuẩn xác cho hệ thống QTTS
 */

/**
 * Chuẩn hóa giá trị từ Excel thành chuỗi DD/MM/YYYY
 * @param {any} v Giá trị ngày tháng từ Excel
 * @returns {string} Chuỗi ngày DD/MM/YYYY hoặc chuỗi rỗng
 */
export function formatExcelDate(v) {
  if (v === null || v === undefined || v === '') return '';

  const s = String(v).trim();
  if (!s || s.toLowerCase().includes('invalid')) return '';

  // Trường hợp là số serial ngày của Excel (ví dụ: 45585)
  if (typeof v === 'number') {
    // Excel tính từ 30/12/1899 do bug năm 1900 nhuận
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
  }

  // Trường hợp là Date instance
  if (v instanceof Date && !isNaN(v.getTime())) {
    const day = String(v.getDate()).padStart(2, '0');
    const month = String(v.getMonth() + 1).padStart(2, '0');
    const year = v.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Khớp chuỗi DD/MM/YYYY hoặc DD-MM-YYYY hoặc DD.MM.YYYY (kể cả có kèm giờ)
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) {
    return `${String(m[1]).padStart(2, '0')}/${String(m[2]).padStart(2, '0')}/${m[3]}`;
  }

  // Khớp chuỗi YYYY-MM-DD (kể cả có kèm giờ ISO)
  const mIso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (mIso) {
    return `${String(mIso[3]).padStart(2, '0')}/${String(mIso[2]).padStart(2, '0')}/${mIso[1]}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return s;
}

/**
 * Lấy chuỗi ngày hôm nay YYYY-MM-DD dùng cho thẻ input date
 */
export function todayYMD() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Chuyển đổi định dạng DD/MM/YYYY hoặc Date thành YYYY-MM-DD
 */
export function toInputDate(v) {
  if (!v) return todayYMD();
  if (typeof v === 'string') {
    const m = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (m) {
      return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return todayYMD();
}

/**
 * Xuất ngày dạng tiêu đề văn bản tiếng Việt: "ngày DD tháng MM năm YYYY"
 * @param {string|Date} dateVal 
 */
export function formatFullTextDateVi(dateVal) {
  let d = new Date();
  if (dateVal) {
    if (typeof dateVal === 'string') {
      const m = dateVal.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
      if (m) {
        d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      } else {
        const pd = new Date(dateVal);
        if (!isNaN(pd.getTime())) d = pd;
      }
    } else if (dateVal instanceof Date) {
      d = dateVal;
    }
  }
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `ngày ${day} tháng ${month} năm ${year}`;
}
