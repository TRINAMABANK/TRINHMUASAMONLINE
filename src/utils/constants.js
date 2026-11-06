/**
 * Hằng số cấu hình hệ thống Quản Trị Tài Sản & Mua Sắm (QTTS)
 */

export const WORKFLOW_STAGES = [
  'Nháp',
  'Chờ trình ký',
  'Đã trình ký',
  'Đã duyệt',
  'Đã đặt hàng',
  'Đã nhận hàng',
  'Hoàn tất',
  'Từ chối'
];

export const STAGE_CONFIG = {
  'Nháp': { color: 'default', badgeClass: 'badge-draft' },
  'Chờ trình ký': { color: 'warning', badgeClass: 'badge-pending' },
  'Đã trình ký': { color: 'info', badgeClass: 'badge-signed' },
  'Đã duyệt': { color: 'primary', badgeClass: 'badge-approved' },
  'Đã đặt hàng': { color: 'secondary', badgeClass: 'badge-ordering' },
  'Đã nhận hàng': { color: 'info', badgeClass: 'badge-received' },
  'Hoàn tất': { color: 'success', badgeClass: 'badge-completed' },
  'Từ chối': { color: 'danger', badgeClass: 'badge-rejected' },
};

export const PAY_GROUPS = [
  { id: 'A', name: 'A. Hội sở thanh toán' },
  { id: 'B', name: 'B. Đơn vị thanh toán' },
];

/**
 * Định nghĩa các trường dữ liệu bắt buộc & tùy chọn
 * cùng danh sách từ khóa bí danh (aliases) để tự nhận diện cột Excel
 */
export const COLUMN_DEFINITIONS = [
  {
    key: 'stt',
    label: 'STT',
    aliases: ['stt', 'so tt', 'so thu tu', 'no'],
    required: false,
    type: 'number'
  },
  {
    key: 'date',
    label: 'Ngày đề xuất',
    aliases: ['ngay de xuat', 'ngay', 'date', 'ngay tao'],
    required: false,
    type: 'date'
  },
  {
    key: 'unit',
    label: 'Tên đơn vị',
    aliases: ['ten don vi', 'don vi', 'chi nhanh', 'phong ban', 'dvkd'],
    required: false,
    type: 'text'
  },
  {
    key: 'supplier',
    label: 'Nhà cung cấp',
    aliases: ['nha cung cap', 'ncc', 'vendor', 'supplier'],
    required: false,
    type: 'text'
  },
  {
    key: 'item',
    label: 'Nội dung',
    aliases: ['noi dung', 'ten hang hoa', 'ten tai san', 'hang hoa', 'san pham', 'item'],
    required: true,
    type: 'text'
  },
  {
    key: 'qty',
    label: 'SL',
    aliases: ['sl', 'so luong', 'quantity', 'soluong'],
    required: true,
    type: 'number'
  },
  {
    key: 'spec',
    label: 'Quy cách',
    aliases: ['quy cach', 'model', 'cau hinh', 'dvt', 'don vi tinh'],
    required: false,
    type: 'text'
  },
  {
    key: 'price',
    label: 'Đơn giá chưa VAT',
    aliases: ['don gia chua vat', 'don gia', 'gia', 'price', 'unit price'],
    required: false,
    type: 'number'
  },
  {
    key: 'amount',
    label: 'Thành tiền chưa VAT',
    aliases: ['thanh tien chua vat', 'thanh tien', 'tong tien', 'amount', 'total'],
    required: false,
    type: 'number'
  },
  {
    key: 'purpose',
    label: 'Mục đích sử dụng',
    aliases: ['muc dich su dung', 'muc dich', 'ly do', 'purpose'],
    required: false,
    type: 'text'
  },
  // Các trường bổ sung nếu có trong hệ thống SSO
  {
    key: 'msp',
    label: 'Mã MSP gốc',
    aliases: ['msp', 'ma phieu', 'ma yeu cau', 'ma phieu goc'],
    required: false,
    type: 'text'
  },
  {
    key: 'unitCode',
    label: 'Mã đơn vị',
    aliases: ['ma dv', 'ma don vi', 'unit code'],
    required: false,
    type: 'text'
  },
  {
    key: 'statusDV',
    label: 'Trạng thái đơn vị',
    aliases: ['tt dvkd', 'tt_dvkd', 'trang thai don vi'],
    required: false,
    type: 'text'
  },
  {
    key: 'statusHO',
    label: 'Trạng thái Hội sở',
    aliases: ['tt ho', 'tt_ho', 'trang thai hoi so'],
    required: false,
    type: 'text'
  }
];

export const TEMPLATE_URLS = {
  BANG_TRINH_KY: '/templates/1_BANG_TRINH_KY.xlsx',
  BANG_KE: '/templates/2_BANG_KE.xlsx',
};
