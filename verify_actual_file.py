import openpyxl
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

file_path = 'test_output/PO-2026-00001_Ho_so_mua_sam_THUC_TE.xlsx'
print(f"=== BẮT ĐẦU KIỂM THỬ XÁC MINH FILE THEO YÊU CẦU MỚI: {file_path} ===")

wb = openpyxl.load_workbook(file_path, data_only=True)

# 1. Kiểm tra số lượng và tên sheet
sheet_names = wb.sheetnames
print(f"\n1. Danh sách Sheet ({len(sheet_names)} sheet): {sheet_names}")
assert len(sheet_names) == 2, f"LỖI: Phải có đúng 2 sheet, thực tế: {len(sheet_names)}"
assert sheet_names[0] == 'PHIẾU TRÌNH', f"LỖI: Sheet 1 phải là 'PHIẾU TRÌNH', thực tế: {sheet_names[0]}"
assert sheet_names[1] == 'BẢNG KÊ', f"LỖI: Sheet 2 phải là 'BẢNG KÊ', thực tế: {sheet_names[1]}"
print("=> ĐẠT: Đúng 01 file và 02 sheet.")

# 2. Kiểm tra Sheet 1: PHIẾU TRÌNH
s1 = wb['PHIẾU TRÌNH']
print("\n2. Kiểm tra Sheet 1 (PHIẾU TRÌNH):")
b11 = s1['B11'].value
b12 = s1['B12'].value
h11 = s1['H11'].value
h12 = s1['H12'].value
f11 = float(s1['F11'].value or 0)
f12 = float(s1['F12'].value or 0)
f13 = float(s1['F13'].value or 0)

print(f"   - B11: {b11}")
print(f"   - H11: {h11}")
print(f"   - F11: {f11:,.0f} đ")
print(f"   - B12: {b12}")
print(f"   - H12: {h12}")
print(f"   - F12: {f12:,.0f} đ")
print(f"   - Dòng 13: {s1['A13'].value} | F13: {f13:,.0f} đ")

expected_b11 = "Mua sắm Các tài sản cố định/Công cụ lao động theo bảng kê: PO-2026-00001 - A. HỘI SỞ THANH TOÁN (Đính kèm bảng kê chi tiết)"
expected_b12 = "Mua sắm Các tài sản cố định/Công cụ lao động theo bảng kê: PO-2026-00001 - B. ĐƠN VỊ THANH TOÁN (Đính kèm bảng kê chi tiết)"
expected_purpose = "Trang bị mua sắm mới/thay thế cho các Đơn vị khu vực Miền Bắc"

assert b11 == expected_b11, f"LỖI: B11 sai định dạng. Thực tế: {b11} != Kỳ vọng: {expected_b11}"
assert b12 == expected_b12, f"LỖI: B12 sai định dạng. Thực tế: {b12} != Kỳ vọng: {expected_b12}"
assert h11 == expected_purpose, f"LỖI: H11 sai mục đích sử dụng. Thực tế: {h11}"
assert h12 == expected_purpose, f"LỖI: H12 sai mục đích sử dụng. Thực tế: {h12}"
assert abs((f11 + f12) - f13) < 0.01, f"LỖI: Tổng tiền Sheet 1 không khớp: {f11} + {f12} != {f13}"
print("=> ĐẠT Sheet 1: Tiêu đề 'Mua sắm Các tài sản cố định/Công cụ lao động theo bảng kê:...' và Mục đích sử dụng 'Trang bị mua sắm mới/thay thế cho các Đơn vị khu vực Miền Bắc' chuẩn xác 100%!")

# 3. Kiểm tra Sheet 2: BẢNG KÊ (Không tách 2 nhóm)
s2 = wb['BẢNG KÊ']
print("\n3. Kiểm tra Sheet 2 (BẢNG KÊ - Không tách nhóm):")
print(f"   - Tiêu đề A4: {s2['A4'].value}")
print(f"   - Tiêu đề A5: {s2['A5'].value}")
print(f"   - Dòng 7 header: {[s2.cell(row=7, column=c).value for c in range(1, 11)]}")

# Kiểm tra dòng 8: Là mặt hàng số 1 (STT 1), KHÔNG PHẢI là 'A. HỘI SỞ THANH TOÁN'
stt_row8 = s2.cell(row=8, column=1).value
assert stt_row8 == 1, f"LỖI: Dòng 8 phải là STT 1, nhưng thực tế là: {stt_row8}"
print(f"   - Dòng 8: STT={stt_row8}, Mặt hàng={s2.cell(row=8, column=5).value}")

# Kiểm tra toàn bộ dòng dữ liệu từ dòng 8 đến dòng 52 (45 mặt hàng)
for i in range(1, 46):
    r = 7 + i
    stt = s2.cell(row=r, column=1).value
    item_name = s2.cell(row=r, column=5).value
    assert stt == i, f"LỖI tại dòng {r}: STT phải là {i}, thực tế là {stt}"
    assert item_name is not None and len(str(item_name).strip()) > 0, f"LỖI tại dòng {r}: Tên mặt hàng rỗng"
    # Đảm bảo không có dòng phân tách nhóm nào xen vào
    assert 'HỘI SỞ THANH TOÁN' not in str(item_name) and 'ĐƠN VỊ THANH TOÁN' not in str(item_name), f"LỖI: Phát hiện tiêu đề nhóm xen vào bảng kê tại dòng {r}"

print("   - Đã kiểm tra 45 mặt hàng: STT chạy liên tục từ 1 đến 45 không bị ngắt quãng bởi nhóm nào!")

# Kiểm tra dòng 53 (7 + 45 + 1): Dòng TỔNG CỘNG CHƯA BAO GỒM VAT
grand_total_row = 7 + 45 + 1
grand_total_label = s2.cell(row=grand_total_row, column=1).value
grand_total_val = float(s2.cell(row=grand_total_row, column=9).value or 0)
print(f"   - Dòng {grand_total_row} (Tổng cộng): Label='{grand_total_label}', Tiền={grand_total_val:,.0f} đ")

assert 'TỔNG CỘNG CHƯA BAO GỒM VAT' in str(grand_total_label), f"LỖI: Dòng {grand_total_row} không phải dòng Tổng cộng chưa VAT"
assert abs(grand_total_val - f13) < 0.01, f"LỖI: Tổng tiền Sheet 2 ({grand_total_val}) không khớp Sheet 1 ({f13})"
print(f"=> ĐẠT Sheet 2: Bảng kê liên tục không tách nhóm, tổng tiền khớp 100% với Sheet 1 ({grand_total_val:,.0f} đ)!")

# Kiểm tra merges
print(f"\n4. Các ô gộp Sheet 2 ({len(s2.merged_cells.ranges)} ranges):")
for m in sorted(list(s2.merged_cells.ranges), key=lambda x: str(x)):
    print(f"   + Merged: {m.coord}")

assert any(str(m.coord) == f"A{grand_total_row}:H{grand_total_row}" for m in s2.merged_cells.ranges), f"LỖI: Dòng tổng cộng A{grand_total_row}:H{grand_total_row} chưa được gộp!"

print("\n=== TẤT CẢ CÁC ĐIỀU KIỆN KIỂM THỬ ĐÃ ĐẠT 100% THÀNH CÔNG ===")
