import { useMemo, useCallback } from 'react';

/**
 * Hook quản lý trạng thái chọn các dòng dữ liệu (Row Selection)
 * Áp dụng functional state updates để đảm bảo tính nguyên tử,
 * không bị stale closure và phản hồi tức thì khi người dùng click từng dòng hoặc chọn tất cả.
 * 
 * @param {Array} rows Danh sách các dòng dữ liệu
 * @param {Function} onUpdateRows Hàm cập nhật lại mảng rows (setRows)
 */
export function useRowSelection(rows = [], onUpdateRows) {
  // Đếm số dòng được chọn (chỉ tính những dòng được tick chọn thực tế)
  const selectedRows = useMemo(() => {
    return rows.filter(r => r && r.selected === true);
  }, [rows]);

  // Tổng tiền các dòng được chọn
  const selectedTotalAmount = useMemo(() => {
    return selectedRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [selectedRows]);

  // Tổng số lượng các dòng được chọn
  const selectedTotalQty = useMemo(() => {
    return selectedRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
  }, [selectedRows]);

  // Trạng thái đã chọn tất cả hay chưa
  const isAllSelected = useMemo(() => {
    return rows.length > 0 && selectedRows.length === rows.length;
  }, [rows.length, selectedRows.length]);

  // Trạng thái chọn một phần (indeterminate)
  const isIndeterminate = useMemo(() => {
    return selectedRows.length > 0 && selectedRows.length < rows.length;
  }, [rows.length, selectedRows.length]);

  // Toggle chọn một dòng (dùng functional update để luôn lấy đúng state mới nhất)
  const toggleRow = useCallback((id, selected) => {
    if (!onUpdateRows) return;
    onUpdateRows(prevRows => {
      return prevRows.map(r => {
        if (r.id === id) {
          const nextVal = selected !== undefined ? Boolean(selected) : !r.selected;
          return { ...r, selected: nextVal };
        }
        return r;
      });
    });
  }, [onUpdateRows]);

  // Toggle chọn hàng loạt dòng (batch update nguyên tử cho cả trang hoặc danh sách id)
  const toggleRowsBatch = useCallback((ids, selected) => {
    if (!onUpdateRows) return;
    const idSet = new Set(Array.isArray(ids) ? ids : [ids]);
    onUpdateRows(prevRows => {
      return prevRows.map(r => {
        if (idSet.has(r.id)) {
          const nextVal = selected !== undefined ? Boolean(selected) : !r.selected;
          return { ...r, selected: nextVal };
        }
        return r;
      });
    });
  }, [onUpdateRows]);

  // Chọn tất cả các dòng trong bảng
  const selectAll = useCallback(() => {
    if (!onUpdateRows) return;
    onUpdateRows(prevRows => prevRows.map(r => ({ ...r, selected: true })));
  }, [onUpdateRows]);

  // Chọn tất cả các dòng chưa phân loại
  const selectAllUnassigned = useCallback(() => {
    if (!onUpdateRows) return;
    onUpdateRows(prevRows => prevRows.map(r => ({
      ...r,
      selected: !r.payGroup ? true : false
    })));
  }, [onUpdateRows]);

  // Bỏ chọn tất cả các dòng
  const deselectAll = useCallback(() => {
    if (!onUpdateRows) return;
    onUpdateRows(prevRows => prevRows.map(r => ({ ...r, selected: false })));
  }, [onUpdateRows]);

  return {
    selectedRows,
    selectedCount: selectedRows.length,
    selectedTotalAmount,
    selectedTotalQty,
    isAllSelected,
    isIndeterminate,
    toggleRow,
    toggleRowsBatch,
    selectAll,
    selectAllUnassigned,
    deselectAll
  };
}
