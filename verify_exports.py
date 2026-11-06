import openpyxl
import glob
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

files = sorted(glob.glob('test_output/*.xlsx'))
print(f'Total exported files verified: {len(files)}')

for fpath in files:
    fname = os.path.basename(fpath)
    wb = openpyxl.load_workbook(fpath, data_only=True)
    ws = wb.active
    merges = sorted([str(m) for m in ws.merged_cells.ranges])
    print(f'\n=== FILE: {fname} ===')
    print(f'Max row: {ws.max_row}, Max col: {ws.max_column}')
    print(f'Merged ranges count: {len(merges)}')
    print('Merged ranges:', merges)
    
    if 'Bang_trinh_ky' in fname:
        f5 = ws['F5'].value
        b11 = ws['B11'].value
        f11 = ws['F11'].value
        b13 = ws['B13'].value
        c24 = ws['C24'].value
        print('  F5 (Date):', repr(f5))
        print('  B11 (Summary text):', repr(b11))
        print(f'  F11 (Total Amount): {f11:,} VND' if isinstance(f11, (int, float)) else f'  F11: {f11}')
        print('  B13 (Sig 1):', repr(b13))
        print('  C24 (Sig 2):', repr(c24))
    elif 'Bang_ke' in fname:
        a4 = ws['A4'].value
        j4 = ws['J4'].value
        print('  A4 (PO Code):', repr(a4))
        print('  J4 (Date):', repr(j4))
        
        # Tìm dòng tổng cộng (bắt đầu bằng TỔNG CỘNG CHƯA BAO GỒM VAT)
        total_row = None
        for r in range(8, ws.max_row + 1):
            val = ws.cell(row=r, column=1).value
            if val and 'TỔNG CỘNG CHƯA BAO GỒM VAT' in str(val):
                total_row = r
                break
        
        if total_row:
            total_amount = ws.cell(row=total_row, column=9).value
            print(f'  Total Row detected at line {total_row}:')
            print('    Col A text:', repr(ws.cell(row=total_row, column=1).value))
            print(f'    Col I amount: {total_amount:,} VND' if isinstance(total_amount, (int, float)) else f'    Col I: {total_amount}')
            
            # Kiểm tra dòng chữ ký
            sig_row = total_row + 3
            print(f'  Signature row at line {sig_row}:')
            print('    Col B:', repr(ws.cell(row=sig_row, column=2).value))
            print('    Col E:', repr(ws.cell(row=sig_row, column=5).value))
            print('    Col I:', repr(ws.cell(row=sig_row, column=9).value))
        else:
            print('  [WARNING] Total row NOT found!')
