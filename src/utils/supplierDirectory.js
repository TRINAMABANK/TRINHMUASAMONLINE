/**
 * Danh mục Nhà cung cấp và Đầu mối Đơn vị Nam A Bank
 * Phục vụ xuất file đơn đặt hàng Excel 9 cột và tạo Email đặt hàng chuyên nghiệp
 */

// Danh bạ liên hệ các Đơn vị / Chi nhánh / OneBank của Nam A Bank
export const DEFAULT_UNIT_CONTACTS = {
  'Chi Nhánh Hà Nội': {
    address: 'Số 14-16 Hàm Long, P. Phan Chu Trinh, Q. Hoàn Kiếm, TP. Hà Nội',
    contactPerson: 'Nguyễn Văn Phúc (Kế toán trưởng)',
    phone: '024.3944.6688 - 0912.345.678'
  },
  'Chi nhánh Thanh Hóa': {
    address: 'Số 124 Trần Phú, P. Điện Biên, TP. Thanh Hóa, Tỉnh Thanh Hóa',
    contactPerson: 'Lê Thị Thu Hà (Phó Giám đốc CN)',
    phone: '0237.3855.999 - 0983.567.890'
  },
  'Chi Nhánh Bắc Hà Nội': {
    address: 'Số 481 Hoàng Quốc Việt, P. Cổ Nhuế 1, Q. Bắc Từ Liêm, TP. Hà Nội',
    contactPerson: 'Trần Đình Trọng (Trưởng phòng QTTS CN)',
    phone: '024.3791.5566 - 0904.123.456'
  },
  'OneBank Bình Minh': {
    address: 'Khu Đô thị Bình Minh, P. Đông Hương, TP. Thanh Hóa, Tỉnh Thanh Hóa',
    contactPerson: 'Phạm Hồng Quân (Trưởng OneBank)',
    phone: '0979.888.777'
  },
  'OneBank Bà Triệu': {
    address: 'Số 218 Bà Triệu, P. Trường Thi, TP. Thanh Hóa, Tỉnh Thanh Hóa',
    contactPerson: 'Hoàng Minh Tuấn (Trưởng OneBank)',
    phone: '0968.112.233'
  },
  'OneBank Thạch Bàn': {
    address: 'Số 128 Cổ Linh, P. Thạch Bàn, Q. Long Biên, TP. Hà Nội',
    contactPerson: 'Nguyễn Ngọc Huyền (Chuyên viên KH OneBank)',
    phone: '0971.223.344'
  },
  'PGD Đồng Xuân': {
    address: 'Số 54 Hàng Khoai, P. Đồng Xuân, Q. Hoàn Kiếm, TP. Hà Nội',
    contactPerson: 'Vũ Thị Minh (Trưởng PGD)',
    phone: '024.3828.1122 - 0913.556.778'
  },
  'PGD Đoan Hùng': {
    address: 'Khu Tân Tiến, Thị trấn Đoan Hùng, Huyện Đoan Hùng, Tỉnh Phú Thọ',
    contactPerson: 'Trần Quốc Đạt (Trưởng PGD)',
    phone: '0210.3881.234 - 0986.778.899'
  },
  'Chi Nhánh Bắc Ninh': {
    address: 'Số 27 Lý Thái Tổ, P. Ninh Xá, TP. Bắc Ninh, Tỉnh Bắc Ninh',
    contactPerson: 'Nguyễn Văn Minh (Phụ trách HCQT)',
    phone: '0222.3811.555 - 0903.445.566'
  },
  'Chi nhánh Phú Thọ': {
    address: 'Số 1682 Đại lộ Hùng Vương, P. Nông Trang, TP. Việt Trì, Phú Thọ',
    contactPerson: 'Bùi Thị Lan (Kế toán)',
    phone: '0210.3847.666 - 0915.667.788'
  },
  'Hội sở': {
    address: '201-203 Cách Mạng Tháng Tám, P. Bàn Cờ, TP. Hồ Chí Minh',
    contactPerson: 'Mr. Trí (Cán bộ QTTS)',
    phone: '0982441446'
  }
};

/**
 * Lấy thông tin liên hệ và địa chỉ của một Đơn vị
 * @param {string} unitName 
 * @returns {{ address: string, contactPerson: string, phone: string }}
 */
export function getUnitContact(unitName) {
  if (!unitName) {
    return {
      address: '201-203 Cách Mạng Tháng Tám, P. Bàn Cờ, TP. Hồ Chí Minh',
      contactPerson: 'Mr. Trí',
      phone: '0982441446'
    };
  }

  const norm = String(unitName).toLowerCase().trim();
  for (const [key, val] of Object.entries(DEFAULT_UNIT_CONTACTS)) {
    if (norm.includes(key.toLowerCase()) || key.toLowerCase().includes(norm)) {
      return val;
    }
  }

  return {
    address: `Trụ sở ${unitName}`,
    contactPerson: `Đại diện nhận hàng ${unitName}`,
    phone: '0982441446'
  };
}

// Danh bạ Nhà cung cấp đã xác thực của Nam A Bank
export const KNOWN_SUPPLIERS = {
  'FTI': {
    code: 'FTI',
    name: 'Công ty TNHH Thương Mại Dịch Vụ Tin Học FTI',
    email: 'ncc_fti@supplier.com',
    phone: '028.7300.2222',
    contactPerson: 'Nguyễn Văn FTI'
  },
  'SIEU_THANH': {
    code: 'SIEU_THANH',
    name: 'Công ty Cổ phần Thiết Bị Văn Phòng Siêu Thanh',
    email: 'ncc_sieuthanh@supplier.com',
    phone: '028.3835.6789',
    contactPerson: 'Trần Văn Siêu Thanh'
  },
  'HANG_TIN': {
    code: 'HANG_TIN',
    name: 'Công ty TNHH Thương Mại Dịch Vụ Hàng Tin',
    email: 'ncc_hangtin@supplier.com',
    phone: '028.3948.5761',
    contactPerson: 'Lê Văn Hàng Tin'
  },
  'VTNH': {
    code: 'VTNH',
    name: 'Công ty Cổ phần Vật Tư Ngân Hàng',
    email: 'vattunganhang@namabank.com.vn',
    phone: '028.3929.6699',
    contactPerson: 'Phòng Cung ứng VTNH'
  },
  'TRUONG_NGUYEN': {
    code: 'TRUONG_NGUYEN',
    name: 'Công ty TNHH Thiết Bị Trương Nguyễn',
    email: 'truongnguyen@supplier.com',
    phone: '028.3812.3456',
    contactPerson: 'Trương Văn Nguyễn'
  },
  'HAI_KET_NOI': {
    code: 'HAI_KET_NOI',
    name: 'Công ty Cổ phần Kết Nối Hai',
    email: 'haiketnoi@supplier.com',
    phone: '028.3999.8888',
    contactPerson: 'Võ Minh Hải'
  },
  'HITEX': {
    code: 'HITEX',
    name: 'Công ty TNHH Công Nghệ Hitex Việt Nam',
    email: 'hitex@supplier.com',
    phone: '024.3888.9999',
    contactPerson: 'Đỗ Quang Hiếu'
  }
};

/**
 * Chuẩn hóa tên / mã nhà cung cấp
 * @param {string} rawSupplier 
 * @returns {{ code: string, name: string, email: string, phone: string, contactPerson: string }}
 */
export function getSupplierInfo(rawSupplier) {
  if (!rawSupplier || String(rawSupplier).trim() === '') {
    return {
      code: 'NCC_KHAC',
      name: 'Nhà cung cấp',
      email: 'sales@supplier.com',
      phone: '0982441446',
      contactPerson: 'Bộ phận Kinh doanh'
    };
  }

  const s = String(rawSupplier).trim();
  const norm = s.toLowerCase();

  if (norm.includes('fti')) return KNOWN_SUPPLIERS.FTI;
  if (norm.includes('siêu thanh') || norm.includes('sieu thanh')) return KNOWN_SUPPLIERS.SIEU_THANH;
  if (norm.includes('hàng tin') || norm.includes('hang tin')) return KNOWN_SUPPLIERS.HANG_TIN;
  if (norm.includes('vật tư ngân hàng') || norm.includes('vat tu ngan hang') || norm.includes('vtnh')) return KNOWN_SUPPLIERS.VTNH;
  if (norm.includes('trương nguyễn') || norm.includes('truong nguyen')) return KNOWN_SUPPLIERS.TRUONG_NGUYEN;
  if (norm.includes('kết nối hai') || norm.includes('hai kết nối') || norm.includes('hai ket noi')) return KNOWN_SUPPLIERS.HAI_KET_NOI;
  if (norm.includes('hitex')) return KNOWN_SUPPLIERS.HITEX;

  // Tự sinh mã và email an toàn cho các NCC khác
  const code = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 16) || 'NCC';

  return {
    code,
    name: s,
    email: `contact@${code.toLowerCase()}.com`,
    phone: '—',
    contactPerson: 'Đại diện bán hàng'
  };
}

/**
 * Sinh đường link riêng theo PO và Nhà cung cấp cho Cổng Đối tác
 * @param {string} poNumber 
 * @param {string} supplierCode 
 * @returns {string}
 */
export function generateSupplierLink(poNumber, supplierCode) {
  const origin = typeof window !== 'undefined' && window.location?.origin 
    ? window.location.origin 
    : 'http://localhost:3000';
  const cleanPO = encodeURIComponent(poNumber || 'PO');
  const cleanSup = encodeURIComponent(supplierCode || 'NCC');
  return `${origin}/?view=supplier_portal&po=${cleanPO}&supplier=${cleanSup}`;
}

/**
 * Tạo nội dung Email đặt hàng chuẩn BẮT BUỘC theo mục A
 * @param {object} params
 * @param {string} params.poNumber
 * @param {string} params.supplierLink
 * @returns {{ subject: string, body: string }}
 */
export function generateOrderEmailTemplate({ poNumber, supplierLink }) {
  const cleanPO = String(poNumber || '').trim();

  // Tiêu đề bắt buộc: NAM A BANK – ĐƠN ĐẶT HÀNG PO [MÃ PO]
  const subject = `NAM A BANK – ĐƠN ĐẶT HÀNG PO ${cleanPO}`;

  // Nội dung bắt buộc đúng 100% không tự ý thay đổi
  const body = `Kính gửi Quý Nhà cung cấp,

NAM A BANK gửi đến Quý Công ty đơn đặt hàng (PO) đính kèm.

Kính đề nghị Quý Công ty vui lòng truy cập đường link bên dưới để nhận thông tin đặt hàng, kiểm tra danh sách hàng hóa và xác nhận đơn đặt hàng, đồng thời cập nhật thời gian dự kiến giao hàng.

LINK XÁC NHẬN ĐẶT HÀNG:
${supplierLink}

Sau khi xác nhận đặt hàng, Quý Công ty vui lòng tiếp tục truy cập đường link trên để cập nhật tình trạng xuất kho và xác nhận hàng hóa đã giao.

ĐẦU MỐI LIÊN HỆ:

Mr. Trí
SĐT: 0982441446

Trân trọng,
NAM A BANK`;

  return { subject, body };
}
