import { useState, useMemo, useCallback } from 'react';

/**
 * Hook quản lý trạng thái chọn các dòng dữ liệu (Row Selection)
 * @param {Array} rows Danh sách các dòng dữ liệu
 * @param {Function} onUpdateRows Hàm cập nhật lại mảng rows
 */
export function useRowSelection(rows = [], onUpdateRows) {
  // Đếm số dòng được chọn (chỉ tính những dòng được tick chọn thực tế)
  const selectedRows = useMemo(() => {
    return rows.filter(r => r.selected === true);
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

  // Toggle chọn một dòng
  const toggleRow = useCallback((id, selected) => {
    if (!onUpdateRows) return;
    const newRows = rows.map(r => {
      if (r.id === id) {
        return { ...r, selected: selected !== undefined ? selected : !r.selected };
      }
      return r;
    });
    onUpdateRows(newRows);
  }, [rows, onUpdateRows]);

  // Chọn tất cả
  const selectAll = useCallback(() => {
    if (!onUpdateRows) return;
    const newRows = rows.map(r => ({ ...r, selected: true }));
    onUpdateRows(newRows);
  }, [rows, onUpdateRows]);

  // Chọn tất cả các dòng chưa phân loại
  const selectAllUnassigned = useCallback(() => {
    if (!onUpdateRows) return;
    const newRows = rows.map(r => ({
      ...r,
      selected: !r.payGroup ? true : false
    }));
    onUpdateRows(newRows);
  }, [rows, onUpdateRows]);

  // Bỏ chọn tất cả
  const deselectAll = useCallback(() => {
    if (!onUpdateRows) return;
    const newRows = rows.map(r => ({ ...r, selected: false }));
    onUpdateRows(newRows);
  }, [rows, onUpdateRows]);

  return {
    selectedRows,
    selectedCount: selectedRows.length,
    selectedTotalAmount,
    selectedTotalQty,
    isAllSelected,
    isIndeterminate,
    toggleRow,
    selectAll,
    selectAllUnassigned,
    deselectAll
  };
}
