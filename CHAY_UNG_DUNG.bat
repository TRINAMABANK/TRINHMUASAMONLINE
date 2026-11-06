@echo off
chcp 65001 > nul
echo ================================================================
echo   HỆ THỐNG QUẢN TRỊ TÀI SẢN & MUA SẮM (QTTS) - SSO 2.0
echo   Kiến trúc Frontend Modular Độc Lập - Phiên bản 2026
echo ================================================================
echo.
echo Đang khởi động máy chủ ứng dụng...
echo Trình duyệt sẽ mở tại địa chỉ: http://localhost:3000
echo.
npm run dev -- --open
pause
