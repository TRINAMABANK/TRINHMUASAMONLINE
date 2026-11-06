import openpyxl
import sys

# Thiết lập encoding utf-8 cho console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

file_path = 'test_output/PO-2026-00001_Ho_so_mua_sam_THUC_TE.xlsx'
print(f"=== BẮT ĐẦU KIỂM THỬ XÁC MINH FILE THỰC TẾ: {file_path} ===")

wb = openpyxl.load_workbook(file_path, data_only=True)

# 1. Kiểm tra số lượng và tên sheet
sheet_names = wb.sheetnames
print(f"1. Danh sách Sheet ({len(sheet_names)} sheet): {sheet_names}")
assert len(sheet_names) == 2, f"LỖI: File phải có đúng 2 sheet, nhưng thực tế có {len(sheet_names)} sheet"
assert sheet_names[0] == 'PHIẾU TRÌNH', f"LỖI: Sheet 1 phải là 'PHIẾU TRÌNH', thực tế là {sheet_names[0]}"
assert sheet_names[1] == 'BẢNG KÊ', f"LỖI: Sheet 2 phải là 'BẢNG KÊ', thực tế là {sheet_names[1]}"
print("=> ĐẠT: Đúng duy nhất 01 file và đúng 02 sheet theo quy định.")

# 2. Kiểm tra Sheet 1: PHIẾU TRÌNH
s1 = wb['PHIẾU TRÌNH']
print("\n2. Kiểm tra Sheet 1 (PHIẾU TRÌNH):")
print("   - Ô A8 (Tiêu đề biểu mẫu):", s1['A8'].value)
print("   - Ô F5 (Ngày tháng đề xuất):", s1['F5'].value)
print("   - Dòng 11 (Khoản 1 - Hội sở TT):", s1['B11'].value[:80] + '...')
print("     + Số tiền Hội sở TT (F11):", s1['F11'].value)
print("   - Dòng 12 (Khoản 2 - Đơn vị TT):", s1['B12'].value[:80] + '...')
print("     + Số tiền Đơn vị TT (F12):", s1['F12'].value)
print("   - Dòng 13 (Tổng cộng chưa VAT):", s1['A13'].value)
print("     + Tổng tiền F13:", s1['F13'].value)

amt_ho_s1 = float(s1['F11'].value or 0)
amt_dv_s1 = float(s1['F12'].value or 0)
total_s1 = float(s1['F13'].value or 0)

assert amt_ho_s1 > 0, "LỖI: Tiền Hội sở Sheet 1 phải > 0"
assert amt_dv_s1 > 0, "LỖI: Tiền Đơn vị Sheet 1 phải > 0"
assert abs((amt_ho_s1 + amt_dv_s1) - total_s1) < 0.01, f"LỖI: Tổng tiền Sheet 1 không khớp: {amt_ho_s1} + {amt_dv_s1} != {total_s1}"
print(f"=> ĐẠT: Sheet 1 có đủ 2 nhóm: Hội sở = {amt_ho_s1:,.0f} đ, Đơn vị = {amt_dv_s1:,.0f} đ, Tổng = {total_s1:,.0f} đ.")
print(f"   - Số ô gộp Sheet 1: {len(s1.merged_cells.ranges)} ranges")
for r in s1.merged_cells.ranges:
    print(f"     + Merged range: {r.coord}")

# 3. Kiểm tra Sheet 2: BẢNG KÊ
s2 = wb['BẢNG KÊ']
print("\n3. Kiểm tra Sheet 2 (BẢNG KÊ):")
print("   - Ô A5 (Tiêu đề hồ sơ):", s2['A5'].value)
print("   - Dòng 10 (Tiêu đề Phần A):", s2['A10'].value)

# Tìm dòng cộng A, dòng bắt đầu B, dòng cộng B, và dòng Tổng cộng
row_subtotal_a = None
row_header_b = None
row_subtotal_b = None
row_grand_total = None

for r in range(11, s2.max_row + 1):
    val_a = str(s2.cell(row=r, column=1).value or '')
    if 'Cộng (Hội sở thanh toán)' in val_a:
        row_subtotal_a = r
    elif 'B. ĐƠN VỊ THANH TOÁN' in val_a:
        row_header_b = r
    elif 'Cộng (Đơn vị thanh toán)' in val_a:
        row_subtotal_b = r
    elif 'TỔNG CỘNG CHƯA BAO GỒM VAT' in val_a:
        row_grand_total = r

print(f"   - Dòng Cộng Nhóm A: {row_subtotal_a}")
print(f"   - Dòng Bắt đầu Nhóm B: {row_header_b}")
print(f"   - Dòng Cộng Nhóm B: {row_subtotal_b}")
print(f"   - Dòng Tổng cộng chung: {row_grand_total}")

assert row_subtotal_a is not None, "LỖI: Không tìm thấy dòng Cộng Nhóm A trong Sheet 2"
assert row_header_b is not None, "LỖI: Không tìm thấy dòng Bắt đầu Nhóm B trong Sheet 2"
assert row_subtotal_b is not None, "LỖI: Không tìm thấy dòng Cộng Nhóm B trong Sheet 2"
assert row_grand_total is not None, "LỖI: Không tìm thấy dòng Tổng cộng chung trong Sheet 2"

amt_ho_s2 = float(s2.cell(row=row_subtotal_a, column=9).value or 0)
amt_dv_s2 = float(s2.cell(row=row_subtotal_b, column=9).value or 0)
total_s2 = float(s2.cell(row=row_grand_total, column=9).value or 0)

print(f"   - Tiền Cộng Phần A (Hội sở): {amt_ho_s2:,.0f} đ")
print(f"   - Tiền Cộng Phần B (Đơn vị): {amt_dv_s2:,.0f} đ")
print(f"   - Tổng cộng chung Sheet 2:  {total_s2:,.0f} đ")

assert abs(amt_ho_s2 - amt_ho_s1) < 0.01, f"LỖI: Tiền Hội sở giữa 2 sheet không khớp: S1={amt_ho_s1} vs S2={amt_ho_s2}"
assert abs(amt_dv_s2 - amt_dv_s1) < 0.01, f"LỖI: Tiền Đơn vị giữa 2 sheet không khớp: S1={amt_dv_s1} vs S2={amt_dv_s2}"
assert abs(total_s2 - total_s1) < 0.01, f"LỖI: Tổng tiền chung giữa 2 sheet không khớp: S1={total_s1} vs S2={total_s2}"
print("=> ĐẠT: Số tiền giữa Sheet 1 và Sheet 2 khớp nhau 100% (cả từng nhóm và tổng cộng)!")

print(f"\n4. Kiểm tra các ô gộp Sheet 2 ({len(s2.merged_cells.ranges)} ranges):")
for r in s2.merged_cells.ranges:
    print(f"   + Merged range: {r.coord}")

print("\n=== TẤT CẢ CÁC BƯỚC KIỂM THỬ XÁC MINH ĐỀU THÀNH CÔNG 100% ===")
