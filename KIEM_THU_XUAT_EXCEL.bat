@echo off
chcp 65001 > nul
echo ================================================================
echo   KIỂM THỬ XUẤT 2 MẪU EXCEL TỰ ĐỘNG & BẢO TOÀN CẤU TRÚC Ô GỘP
echo ================================================================
echo.
echo 1. Chạy test case (1 dòng, 5 dòng, 20 dòng):
node test_export_verification.js
echo.
echo 2. Chạy test case nạp file phiếu thô thật (PHIEU_THO.xlsx):
node test_integration.js
echo.
echo 3. Dùng Python mở và kiểm tra xác minh ô gộp, công thức, tổng tiền:
python verify_exports.py
echo.
echo ================================================================
echo Các file Excel đã được xuất vào thư mục: test_output/
echo ================================================================
pause
