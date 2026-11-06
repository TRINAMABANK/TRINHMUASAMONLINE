/**
 * TẬP TRUNG TOÀN BỘ TỌA ĐỘ VÀ CẤU TRÚC MẪU EXCEL
 * Muốn chỉnh sửa tọa độ ô trong 2 file mẫu, chỉ cần chỉnh sửa tại file này!
 */

export const TEMPLATE_CONFIG = {
  // ==========================================
  // FILE 1: BẢNG TRÌNH KÝ (1_BANG_TRINH_KY.xlsx)
  // ==========================================
  TRINH_KY: {
    sheetIndex: 0,
    expectedSheetName: 'PYC (20)',
    cells: {
      // Ô ngày tháng địa điểm (F5 nằm trong merged F5:H5)
      dateCell: 'F5',
      // Dòng hàng hóa tóm tắt
      summaryRowIndex: 11,
      colSTT: 'A',
      colItem: 'B',
      colSpec: 'C',
      colPrice: 'D',
      colQty: 'E',
      colAmount: 'F',
      colSupplier: 'G',
      colPurpose: 'H',
    },
    rowHeight: 58,
    // Vùng chữ ký cố định từ dòng 13 trở đi
    signaturesStartRow: 13,
  },

  // ==========================================
  // FILE 2: BẢNG KÊ (2_BANG_KE.xlsx)
  // ==========================================
  BANG_KE: {
    sheetIndex: 0,
    expectedSheetName: 'PO17-2910B',
    cells: {
      // Mã PO (A4)
      poCodeCell: 'A4',
      // Ngày tháng địa điểm (J4)
      dateCell: 'J4',
      // Tiêu đề bảng
      titleCell: 'A5',
    },
    // Header bảng nằm ở dòng 7
    headerRowIndex: 7,
    // Các cột dữ liệu từ 1 đến 10
    columns: {
      stt: 1,        // Col A: STT
      date: 2,       // Col B: Ngày đề xuất
      unit: 3,       // Col C: Tên đơn vị
      supplier: 4,   // Col D: Nhà cung cấp
      item: 5,       // Col E: Nội dung
      qty: 6,        // Col F: SL
      spec: 7,       // Col G: Quy cách
      price: 8,      // Col H: Đơn giá chưa VAT
      amount: 9,     // Col I: Thành tiền chưa VAT
      purpose: 10,   // Col J: Mục đích sử dụng
    },
    // Số dòng dữ liệu có sẵn trong template mẫu gốc cho nhóm A (từ dòng 9 đến 14 = 6 dòng)
    groupA: {
      headerRow: 8,
      firstDataRow: 9,
      templateRowCount: 6, // 9, 10, 11, 12, 13, 14
    },
    groupB: {
      headerRow: 15,
      firstDataRow: 16,
      templateRowCount: 1, // 16
    },
    // Vị trí dòng tổng cộng ban đầu trong mẫu gốc (Row 17)
    originalTotalRow: 17,
    // Vị trí dòng chữ ký ban đầu trong mẫu gốc (Row 20)
    originalSignatureRow: 20,
    // Chiều cao tiêu chuẩn của mỗi dòng hàng hóa (pixel/point)
    dataRowHeight: 32,
  }
};
