import openpyxl
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

file_path = 'test_output/HO_SO_TRINH_KY_UPGRADE.xlsx'
print(f"=== BẮT ĐẦU KIỂM TRA TOÀN DIỆN FILE EXCEL XUẤT RA: {file_path} ===")

wb = openpyxl.load_workbook(file_path, data_only=True)

# 1. Kiểm tra số lượng và tên sheet
sheet_names = wb.sheetnames
print(f"\n1. Danh sách Sheet ({len(sheet_names)} sheet): {sheet_names}")
assert len(sheet_names) == 2, f"LỖI: Phải có đúng 2 sheet, thực tế: {len(sheet_names)}"
assert sheet_names[0] == 'PHIẾU TRÌNH', f"LỖI: Sheet 1 phải là 'PHIẾU TRÌNH', thực tế: {sheet_names[0]}"
assert sheet_names[1] == 'BẢNG KÊ', f"LỖI: Sheet 2 phải là 'BẢNG KÊ', thực tế: {sheet_names[1]}"
print("=> ĐẠT MỤC 1: Đúng 01 file và đúng 02 sheet (1. PHIẾU TRÌNH, 2. BẢNG KÊ).")

# 2. Kiểm tra Sheet 1: PHIẾU TRÌNH
s1 = wb['PHIẾU TRÌNH']
print("\n2. Kiểm tra Sheet 1 (PHIẾU TRÌNH):")
a11 = s1['A11'].value
b11 = s1['B11'].value
e11 = s1['E11'].value
f11 = float(s1['F11'].value or 0)
g11 = s1['G11'].value
h11 = s1['H11'].value

print(f"   - A11 (STT): {a11}")
print(f"   - B11 (Tên hàng hóa): {b11}")
print(f"   - E11 (Tổng SL): {e11}")
print(f"   - F11 (Tổng tiền chưa VAT): {f11:,.0f} đ")
print(f"   - G11 (Ghi chú/NCC): {g11}")
print(f"   - H11 (Mục đích sử dụng): {h11}")

assert a11 == 1, f"LỖI: A11 phải là 1, thực tế: {a11}"
assert "PO-2026-00048" in str(b11), f"LỖI: B11 phải chứa mã PO"
assert "Đính kèm bảng kê chi tiết" in str(b11), f"LỖI: B11 phải có '(Đính kèm bảng kê chi tiết)'"
assert f11 == 515173000, f"LỖI: F11 tổng tiền không đúng: {f11}"
assert e11 == 45, f"LỖI: E11 tổng SL phải là 45"

# Dòng 12: Dòng Tổng cộng chưa VAT
a12 = s1['A12'].value
f12 = float(s1['F12'].value or 0)
print(f"   - Dòng 12: Label='{a12}', Tiền={f12:,.0f} đ")
assert 'TỔNG CỘNG CHƯA BAO GỒM VAT' in str(a12), f"LỖI: Dòng 12 phải là dòng tổng cộng chưa VAT"
assert f12 == f11, f"LỖI: F12 ({f12}) phải bằng F11 ({f11})"

# Dòng 14: Người lập phiếu, BP Mua hàng
b14 = s1['B14'].value
g14 = s1['G14'].value
print(f"   - Dòng 14 chữ ký: B14='{b14}', G14='{g14}'")
assert b14 == 'NGƯỜI LẬP PHIẾU', f"LỖI: B14 phải là 'NGƯỜI LẬP PHIẾU'"
assert g14 == 'BP. MUA HÀNG/TRƯỞNG ĐƠN VỊ', f"LỖI: G14 phải là 'BP. MUA HÀNG/TRƯỞNG ĐƠN VỊ'"

print("=> ĐẠT MỤC 2: Sheet 1 PHIẾU TRÌNH CHỈ CÓ ĐÚNG 01 HÀNG DỮ LIỆU TỔNG HỢP DUY NHẤT!")

# 3. Kiểm tra Sheet 2: BẢNG KÊ (02 Nhóm thanh toán riêng biệt)
s2 = wb['BẢNG KÊ']
print("\n3. Kiểm tra Sheet 2 (BẢNG KÊ - 2 Nhóm thanh toán):")
print(f"   - Tiêu đề A4: {s2['A4'].value}")
print(f"   - Dòng 7 header: {[s2.cell(row=7, column=c).value for c in range(1, 11)]}")

# Dòng 8: Header Nhóm I
row8_val = s2.cell(row=8, column=1).value
print(f"   - Dòng 8 (Header Nhóm I): '{row8_val}'")
assert 'NHÓM I' in str(row8_val) and 'HỘI SỞ THANH TOÁN' in str(row8_val), f"LỖI Dòng 8: {row8_val}"

# 10 dòng của Nhóm I (Dòng 9 đến 18)
print("   - Đang kiểm tra 10 dòng của Nhóm I (Hội sở thanh toán):")
sum_amount_g1 = 0
sum_qty_g1 = 0
for idx in range(1, 11):
    r = 8 + idx
    stt = s2.cell(row=r, column=1).value
    item_name = s2.cell(row=r, column=5).value
    qty = s2.cell(row=r, column=6).value
    amount = float(s2.cell(row=r, column=9).value or 0)
    sum_qty_g1 += qty
    sum_amount_g1 += amount
    assert stt == idx, f"LỖI Nhóm I: STT dòng {r} phải là {idx}, thực tế: {stt}"
    assert item_name is not None and len(str(item_name).strip()) > 0, f"LỖI Nhóm I dòng {r}: Tên hàng rỗng"

print(f"     -> Nhóm I có 10 dòng: Tổng SL = {sum_qty_g1}, Tổng tiền = {sum_amount_g1:,.0f} đ")

# Dòng 19: Dòng tổng cộng Nhóm I
row19_label = s2.cell(row=19, column=1).value
row19_qty = s2.cell(row=19, column=6).value
row19_amount = float(s2.cell(row=19, column=9).value or 0)
print(f"   - Dòng 19 (Cộng Nhóm I): Label='{row19_label}', SL={row19_qty}, Tiền={row19_amount:,.0f} đ")
assert 'CỘNG NHÓM I' in str(row19_label), f"LỖI: Dòng 19 phải là 'CỘNG NHÓM I'"
assert row19_qty == sum_qty_g1, f"LỖI: SL cộng Nhóm I không khớp: {row19_qty} != {sum_qty_g1}"
assert abs(row19_amount - sum_amount_g1) < 0.01, f"LỖI: Tiền cộng Nhóm I không khớp: {row19_amount} != {sum_amount_g1}"

# Dòng 20: Header Nhóm II
row20_val = s2.cell(row=20, column=1).value
print(f"   - Dòng 20 (Header Nhóm II): '{row20_val}'")
assert 'NHÓM II' in str(row20_val) and 'ĐƠN VỊ THANH TOÁN' in str(row20_val), f"LỖI Dòng 20: {row20_val}"

# 35 dòng của Nhóm II (Dòng 21 đến 55)
print("   - Đang kiểm tra 35 dòng của Nhóm II (Đơn vị thanh toán):")
sum_amount_g2 = 0
sum_qty_g2 = 0
for idx in range(1, 36):
    r = 20 + idx
    stt = s2.cell(row=r, column=1).value
    item_name = s2.cell(row=r, column=5).value
    qty = s2.cell(row=r, column=6).value
    amount = float(s2.cell(row=r, column=9).value or 0)
    sum_qty_g2 += qty
    sum_amount_g2 += amount
    assert stt == idx, f"LỖI Nhóm II: STT dòng {r} phải là {idx}, thực tế: {stt}"
    assert item_name is not None and len(str(item_name).strip()) > 0, f"LỖI Nhóm II dòng {r}: Tên hàng rỗng"

print(f"     -> Nhóm II có 35 dòng: Tổng SL = {sum_qty_g2}, Tổng tiền = {sum_amount_g2:,.0f} đ")

# Dòng 56: Dòng tổng cộng Nhóm II
row56_label = s2.cell(row=56, column=1).value
row56_qty = s2.cell(row=56, column=6).value
row56_amount = float(s2.cell(row=56, column=9).value or 0)
print(f"   - Dòng 56 (Cộng Nhóm II): Label='{row56_label}', SL={row56_qty}, Tiền={row56_amount:,.0f} đ")
assert 'CỘNG NHÓM II' in str(row56_label), f"LỖI: Dòng 56 phải là 'CỘNG NHÓM II'"
assert row56_qty == sum_qty_g2, f"LỖI: SL cộng Nhóm II không khớp: {row56_qty} != {sum_qty_g2}"
assert abs(row56_amount - sum_amount_g2) < 0.01, f"LỖI: Tiền cộng Nhóm II không khớp: {row56_amount} != {sum_amount_g2}"

# 4. Kiểm tra phần Tổng kết Cuối bảng của Sheet 2
print("\n4. Kiểm tra phần Tổng kết Cuối bảng của Sheet 2:")
# Dòng 57: Tổng tiền Nhóm I
row57_label = s2.cell(row=57, column=1).value
row57_amount = float(s2.cell(row=57, column=9).value or 0)
print(f"   - Dòng 57: Label='{row57_label}', Tiền={row57_amount:,.0f} đ")
assert 'TỔNG TIỀN NHÓM I' in str(row57_label), f"LỖI Dòng 57: {row57_label}"
assert abs(row57_amount - sum_amount_g1) < 0.01, f"LỖI: Tổng tiền Nhóm I cuối bảng không khớp"

# Dòng 58: Tổng tiền Nhóm II
row58_label = s2.cell(row=58, column=1).value
row58_amount = float(s2.cell(row=58, column=9).value or 0)
print(f"   - Dòng 58: Label='{row58_label}', Tiền={row58_amount:,.0f} đ")
assert 'TỔNG TIỀN NHÓM II' in str(row58_label), f"LỖI Dòng 58: {row58_label}"
assert abs(row58_amount - sum_amount_g2) < 0.01, f"LỖI: Tổng tiền Nhóm II cuối bảng không khớp"

# Dòng 59: Tổng cộng toàn bộ bảng kê
row59_label = s2.cell(row=59, column=1).value
row59_amount = float(s2.cell(row=59, column=9).value or 0)
print(f"   - Dòng 59: Label='{row59_label}', Tiền={row59_amount:,.0f} đ")
assert 'TỔNG CỘNG CHƯA BAO GỒM VAT' in str(row59_label), f"LỖI Dòng 59: {row59_label}"
assert abs(row59_amount - (sum_amount_g1 + sum_amount_g2)) < 0.01, f"LỖI: Tổng cộng không bằng tổng 2 nhóm"

# 5. Đối chiếu số liệu giữa 2 sheet
print("\n5. Đối chiếu số liệu giữa 2 sheet:")
print(f"   - Sheet 1 (PHIẾU TRÌNH): {f11:,.0f} đ")
print(f"   - Sheet 2 Nhóm I:        {sum_amount_g1:,.0f} đ")
print(f"   - Sheet 2 Nhóm II:       {sum_amount_g2:,.0f} đ")
print(f"   - Sheet 2 Tổng cộng:     {row59_amount:,.0f} đ")

assert abs(f11 - row59_amount) < 0.01, f"LỖI: Sheet 1 ({f11}) != Sheet 2 ({row59_amount})"
assert abs(f11 - (sum_amount_g1 + sum_amount_g2)) < 0.01, f"LỖI: Sheet 1 != Tổng 2 nhóm"
print("=> ĐẠT MỤC 4: Tổng tiền PHIẾU TRÌNH = Tổng tiền Nhóm I + Tổng tiền Nhóm II trên BẢNG KÊ (Khớp 100% không chênh lệch 1 đồng)!")

print("\n=== TẤT CẢ CÁC ĐIỀU KIỆN KIỂM THỬ ĐÃ ĐẠT 100% THÀNH CÔNG! ===")
