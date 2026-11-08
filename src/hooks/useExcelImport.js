import { useState, useCallback, useRef } from 'react';
import { excelReader } from '../services/excelReader.js';
import { parseCurrency } from '../utils/currencyUtils.js';
import { validateRow } from '../utils/validation.js';

export function useExcelImport() {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Stack lưu lịch sử để hỗ trợ nút HOÀN TÁC (Undo)
  const historyRef = useRef([]);

  // Lưu snapshot vào history trước khi thay đổi dữ liệu
  const pushHistory = useCallback((currentRows) => {
    historyRef.current.push(JSON.parse(JSON.stringify(currentRows)));
    // Giới hạn tối đa 20 bước hoàn tác
    if (historyRef.current.length > 20) {
      historyRef.current.shift();
    }
  }, []);

  // Xử lý nạp file
  const handleFileImport = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await excelReader.readExcelFile(file);
      setFileName(result.fileName);
      setHeaders(result.headers);
      setRows(result.rows);
      historyRef.current = []; // Reset history
    } catch (err) {
      console.error('Lỗi nhập Excel:', err);
      setError(err.message || 'Không thể đọc file Excel.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cập nhật giá trị một ô
  const updateCell = useCallback((id, key, value) => {
    setRows(prevRows => {
      pushHistory(prevRows);
      return prevRows.map(row => {
        if (row.id !== id) return row;

        const updatedRow = { ...row };
        if (key === 'qty' || key === 'price' || key === 'amount') {
          updatedRow[key] = parseCurrency(value);
        } else {
          updatedRow[key] = value;
        }

        // Tự động tính lại thành tiền khi thay đổi Số lượng hoặc Đơn giá
        if (key === 'qty' || key === 'price') {
          const q = Number(updatedRow.qty) || 0;
          const p = Number(updatedRow.price) || 0;
          updatedRow.amount = q * p;
        }

        return updatedRow;
      });
    });
  }, [pushHistory]);

  // Thêm một dòng mới
  const addRow = useCallback((defaultValues = {}) => {
    setRows(prevRows => {
      pushHistory(prevRows);
      const newRow = {
        id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        stt: prevRows.length + 1,
        date: new Date().toLocaleDateString('vi-VN'),
        unit: '',
        supplier: '',
        item: '',
        qty: 1,
        spec: 'CÁI',
        price: 0,
        amount: 0,
        purpose: '',
        msp: '',
        payGroup: null,
        selected: false,
        ...defaultValues
      };
      return [...prevRows, newRow];
    });
  }, [pushHistory]);

  // Phân loại hàng loạt các dòng được chọn vào nhóm thanh toán
  const classifyRows = useCallback((paymentType, rowIds = null) => {
    setRows(prevRows => {
      pushHistory(prevRows);
      return prevRows.map(row => {
        const isTarget = rowIds ? rowIds.includes(row.id) : row.selected === true;
        if (isTarget) {
          return {
            ...row,
            payGroup: paymentType,
            selected: false // Tự động bỏ tick sau khi đã ACCEPT thành công
          };
        }
        return row;
      });
    });
  }, [pushHistory]);

  // Hủy phân loại cho các dòng chỉ định
  const unclassifyRows = useCallback((rowIds) => {
    setRows(prevRows => {
      pushHistory(prevRows);
      const targetIds = Array.isArray(rowIds) ? rowIds : [rowIds];
      return prevRows.map(row => {
        if (targetIds.includes(row.id)) {
          return {
            ...row,
            payGroup: null
          };
        }
        return row;
      });
    });
  }, [pushHistory]);

  // Hủy phân loại toàn bộ cho một nhóm (HOI_SO hoặc DON_VI)
  const unclassifyGroup = useCallback((groupType) => {
    setRows(prevRows => {
      pushHistory(prevRows);
      return prevRows.map(row => {
        if (row.payGroup === groupType) {
          return {
            ...row,
            payGroup: null
          };
        }
        return row;
      });
    });
  }, [pushHistory]);

  // Xóa một dòng
  const deleteRow = useCallback((id) => {
    setRows(prevRows => {
      pushHistory(prevRows);
      const filtered = prevRows.filter(r => r.id !== id);
      // Đánh số lại STT
      return filtered.map((r, i) => ({ ...r, stt: i + 1 }));
    });
  }, [pushHistory]);

  // Sao chép một dòng
  const duplicateRow = useCallback((id) => {
    setRows(prevRows => {
      pushHistory(prevRows);
      const targetIndex = prevRows.findIndex(r => r.id === id);
      if (targetIndex < 0) return prevRows;

      const source = prevRows[targetIndex];
      const copied = {
        ...JSON.parse(JSON.stringify(source)),
        id: `row_${Date.now()}_copy_${Math.random().toString(36).substring(2, 6)}`,
      };

      const nextRows = [...prevRows];
      nextRows.splice(targetIndex + 1, 0, copied);
      return nextRows.map((r, i) => ({ ...r, stt: i + 1 }));
    });
  }, [pushHistory]);

  // HOÀN TÁC (Undo)
  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return false;
    const previousState = historyRef.current.pop();
    setRows(previousState);
    return true;
  }, []);

  // Xóa trắng toàn bộ dữ liệu bảng
  const clearData = useCallback(() => {
    setFileName('');
    setRows([]);
    setHeaders([]);
    setError(null);
    historyRef.current = [];
  }, []);

  // Kiểm tra danh sách cảnh báo
  const warnings = rows.flatMap((row, idx) => validateRow(row, idx));

  return {
    fileName,
    rows,
    headers,
    isLoading,
    error,
    warnings,
    canUndo: historyRef.current.length > 0,
    handleFileImport,
    setRows,
    updateCell,
    addRow,
    deleteRow,
    duplicateRow,
    classifyRows,
    unclassifyRows,
    unclassifyGroup,
    undo,
    clearData
  };
}
