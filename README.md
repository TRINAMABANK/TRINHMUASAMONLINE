# HỆ THỐNG QUẢN TRỊ TÀI SẢN & MUA SẮM (QTTS) - SSO 2.0

> Ứng dụng Frontend chuyên nghiệp xử lý phiếu mua sắm, quản trị tài sản và xuất 2 file Excel (Bảng Trình Ký & Bảng Kê) theo chuẩn doanh nghiệp.

---

## 1. MỤC TIÊU & QUY TRÌNH HOẠT ĐỘNG

Hệ thống hoạt động theo quy trình 5 bước tinh giản, không qua các bước ghép cột phức tạp:

```text
[1. Upload file Excel phiếu thô]
              ↓
[2. Tự động đọc dữ liệu 10 cột]
              ↓
[3. Chỉnh sửa trực tiếp từng ô / dòng trên bảng tương tác]
              ↓
[4. Tick chọn các dòng hàng hóa cần lập hồ sơ]
              ↓
[5. Tự động sinh mã PO duy nhất & Xuất cùng lúc 2 file Excel]
   ├── 1. BẢNG TRÌNH KÝ (1_BANG_TRINH_KY.xlsx)
   └── 2. BẢNG KÊ CHI TIẾT (2_BANG_KE.xlsx)
```

---

## 2. CẤU TRÚC SOURCE CODE (MODULAR ARCHITECTURE)

Dự án được tái cấu trúc thành các module độc lập, phân định ranh giới chức năng rõ ràng:

```text
QTTS/
│
├── src/
│   ├── components/
│   │   ├── UploadExcel.jsx    # Khu vực kéo thả & nạp file Excel phiếu thô
│   │   ├── DataTable.jsx      # Bảng dữ liệu: sửa ô, tìm kiếm, lọc, sắp xếp, phân trang
│   │   ├── EditableCell.jsx   # Ô chỉnh sửa trực tiếp (inline editable cell)
│   │   ├── RowSelection.jsx   # Thanh công cụ tick chọn và đếm tổng tiền được chọn
│   │   ├── POToolbar.jsx      # Toolbar thiết lập mã PO, ngày, người lập và nút xuất file
│   │   └── StatusBadge.jsx    # Huy hiệu trạng thái quy trình (Nháp, Trình ký, Duyệt...)
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx      # Bảng điều khiển KPI tổng quan và hồ sơ gần đây
│   │   ├── ImportPage.jsx     # Trang quy trình chính: Upload -> Chỉnh sửa -> Xuất 2 file
│   │   ├── POManagement.jsx   # Quản lý vòng đời PO, theo dõi workflow, modal chi tiết
│   │   ├── ExportPage.jsx     # Trung tâm tải template gốc & xuất Excel từng hồ sơ
│   │   └── ReportPage.jsx     # Báo cáo phân tích giá trị theo nhà cung cấp & tiến độ
│   │
│   ├── services/
│   │   ├── excelReader.js     # Đọc và parse file Excel phiếu thô (.xlsx, .xls)
│   │   ├── excelExporter.js   # Xuất 2 file Excel, xử lý an toàn ô gộp & dòng tổng cộng
│   │   ├── templateMapper.js  # Tập trung toàn bộ tọa độ ô và cấu trúc 2 mẫu Excel
│   │   ├── poGenerator.js     # Sinh mã PO tự động: PO-2026-00001 (không trùng lặp)
│   │   └── storageService.js  # Lưu trữ hồ sơ, lịch sử xử lý (logs) và sao lưu JSON
│   │
│   ├── utils/
│   │   ├── dateUtils.js       # Xử lý và format ngày tháng chuẩn Việt Nam (DD/MM/YYYY)
│   │   ├── currencyUtils.js   # Xử lý tiền tệ, chuyển đổi số và format #,##0 đ
│   │   ├── validation.js      # Xác thực dòng bắt buộc, trích xuất mã MSP, tìm kiếm tiếng Việt
│   │   └── constants.js       # Hằng số cấu hình: các bước trạng thái, alias nhận diện cột
│   │
│   ├── hooks/
│   │   ├── useExcelImport.js  # Hook quản lý nạp Excel, sửa cell, thêm/xóa dòng, HOÀN TÁC (Undo)
│   │   ├── useRowSelection.js # Hook quản lý tick chọn từng dòng, chọn tất cả, tổng tiền chọn
│   │   └── usePOManagement.js # Hook quản lý hồ sơ PO, cập nhật trạng thái, xuất 2 file
│   │
│   ├── styles/
│   │   └── main.css           # Toàn bộ giao diện chuẩn doanh nghiệp (Xanh Navy, Trắng, Xanh Dương)
│   │
│   ├── App.jsx                # Khung ứng dụng chính, Sidebar bên trái, Topbar và Routing
│   └── main.jsx               # Điểm khởi động ứng dụng React 18
│
├── public/
│   ├── templates/
│   │   ├── 1_BANG_TRINH_KY.xlsx   # Mẫu BẢNG TRÌNH KÝ gốc
│   │   └── 2_BANG_KE.xlsx         # Mẫu BẢNG KÊ gốc
│   └── test_files/
│       └── PHIEU_THO.xlsx         # File phiếu thô 45 dòng thử nghiệm thực tế
│
├── test_output/               # Thư mục lưu các file Excel xuất ra khi chạy kiểm thử
├── CHAY_UNG_DUNG.bat          # File chạy ứng dụng trực tiếp bằng 1 cú nhấp đúp
├── KIEM_THU_XUAT_EXCEL.bat    # File chạy kiểm thử xuất 2 file Excel tự động
├── package.json
└── vite.config.js
```

---

## 3. QUY TẮC BẢO TRÌ & CHỈNH SỬA VỀ SAU

Để duy trì tính ổn định của hệ thống, khi cần thay đổi bất kỳ chức năng nào, hãy sửa đúng file tương ứng:

| Muốn thay đổi... | Sửa đúng file... | Ghi chú |
| :--- | :--- | :--- |
| **Giao diện bảng dữ liệu** | `src/components/DataTable.jsx` | Thêm cột hiển thị, thay đổi tìm kiếm, phân trang |
| **Cách đọc & nhận diện Excel** | `src/services/excelReader.js` | Thay đổi alias cột, cách đọc số liệu |
| **Cách xuất 2 file Excel** | `src/services/excelExporter.js` | Logic điền dữ liệu, style, font chữ, dòng tổng |
| **Tọa độ ô trong file mẫu** | `src/services/templateMapper.js` | Thay đổi ô ngày tháng, ô mã PO, ô tổng tiền |
| **Quy tắc sinh mã PO** | `src/services/poGenerator.js` | Định dạng tiền tố, số lượng chữ số tăng dần |
| **Giao diện, màu sắc, font** | `src/styles/main.css` | Màu chủ đạo xanh navy, responsive, spacing |
| **Quy trình trạng thái (Workflow)**| `src/hooks/usePOManagement.js` | Các bước duyệt, đặt hàng, nhận hàng |

---

## 4. HƯỚNG DẪN KHỞI CHẠY ỨNG DỤNG

### Cách 1: Dùng file chạy nhanh (Khuyên dùng)
- Nhấp đúp chuột vào file: **`CHAY_UNG_DUNG.bat`**.
- Trình duyệt sẽ tự động mở ứng dụng tại: `http://localhost:3000`.

### Cách 2: Khởi chạy bằng dòng lệnh
```powershell
# Chạy môi trường phát triển (Hot reload)
npm run dev

# Hoặc build bản triển khai production
npm run build
```

---

## 5. HƯỚNG DẪN KIỂM THỬ XUẤT EXCEL TỰ ĐỘNG

Nhấp đúp chuột vào file: **`KIEM_THU_XUAT_EXCEL.bat`** hoặc chạy lệnh:
```powershell
node test_export_verification.js
node test_integration.js
python verify_exports.py
```

Toàn bộ 6 file Excel kết quả sẽ được tạo trong thư mục `test_output/`:
- `PO-2026-00001_01_Bang_trinh_ky.xlsx`
- `PO-2026-00001_02_Bang_ke.xlsx`
- `PO-2026-00005_01_Bang_trinh_ky.xlsx`
- `PO-2026-00005_02_Bang_ke.xlsx`
- `PO-2026-00020_01_Bang_trinh_ky.xlsx`
- `PO-2026-00020_02_Bang_ke.xlsx`

Script python kiểm tra xác minh:
- Đủ 7 vùng gộp chuẩn của mẫu gốc (`A14:E14`, `A8:H8`, `C24:F24`, `F1:H1`, `F2:H2`, `F5:H5`, `G13:H13` cho Trình Ký và `A{total}:H{total}`, `B{sig}:C{sig}`, `E{sig}:G{sig}`, `I{sig}:J{sig}` cho Bảng Kê).
- Không vỡ ô gộp, không mất công thức hay sai lệch dòng tổng tiền và chữ ký.
