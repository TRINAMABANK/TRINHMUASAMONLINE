import { useState, useEffect, useCallback } from 'react';
import { poApi } from '../services/api/poApi.js';
import { storageService } from '../services/storageService.js';
import { generateNextPONumber } from '../services/poGenerator.js';
import { excelExporter } from '../services/excelExporter.js';

export function usePOManagement() {
  const [pos, setPOs] = useState([]);
  const [activePOId, setActivePOId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);

  // Chuyển đổi dữ liệu từ Backend PostgreSQL sang định dạng chuẩn của giao diện
  const normalizeBackendPO = (p) => {
    return {
      id: p.id,
      po: p.po_number || p.po,
      po_number: p.po_number || p.po,
      date: p.order_date ? new Date(p.order_date).toISOString().slice(0, 10) : p.date,
      requester: p.requester_name || p.requester,
      note: p.note || '',
      submission_status: p.submission_status || 'KHOI_TAO',
      po_status: p.po_status || 'DA_TAO_PO',
      delivery_status: p.delivery_status || 'CHUA_GIAO',
      current_stage: p.current_stage || 'PHIEU_TRINH_XUAT',
      is_overdue: p.is_overdue || false,
      status: p.delivery_status === 'HOAN_TAT' || p.po_status === 'HOAN_TAT'
        ? 'Hoàn tất'
        : p.delivery_status === 'DANG_GIAO'
          ? 'Đang giao hàng'
          : p.po_status === 'DA_TAO_PO' || p.po_status === 'DOI_TAC_XAC_NHAN'
            ? 'Đã đặt hàng'
            : p.submission_status === 'DA_DUYET'
              ? 'Đã duyệt'
              : 'Chờ trình ký',
      items: (p.items || []).map(it => ({
        id: it.id,
        stt: it.stt,
        date: it.request_date || it.date || '',
        request_date: it.request_date || it.date || '',
        unit: it.unit_name || it.unit,
        supplier: it.supplier_name || it.supplier,
        item: it.item_name || it.item,
        qty: Number(it.qty) || 1,
        spec: it.spec || 'CÁI',
        price: Number(it.unit_price || it.price) || 0,
        amount: Number(it.amount) || 0,
        purpose: it.purpose || '',
        msp: it.msp || '',
        payGroup: it.pay_group || it.payGroup || null,
        receivedQty: Number(it.received_qty) || 0,
        selected: it.selected !== false
      })),
      created: p.created_at || p.created || new Date().toISOString(),
      updated: p.updated_at ? new Date(p.updated_at).toLocaleString('vi-VN') : (p.updated || new Date().toLocaleString('vi-VN')),
      logs: p.logs || []
    };
  };

  // Load danh sách từ Backend API (kết nối PostgreSQL thật)
  const refreshPOs = useCallback(async (filters = {}) => {
    setIsLoading(true);
    try {
      const res = await poApi.getPOs(filters);
      if (res.success && Array.isArray(res.data)) {
        const normalized = res.data.map(normalizeBackendPO);
        setPOs(normalized);
        storageService.savePOs(normalized); // Đồng bộ vào local cache
        setApiOnline(true);
        return normalized;
      }
    } catch (e) {
      console.warn('[usePOManagement] Không thể tải từ API Backend, chuyển sang LocalStorage fallback:', e.message);
      setApiOnline(false);
      const list = storageService.getPOs();
      setPOs(list);
      return list;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPOs();
  }, [refreshPOs]);

  // Hồ sơ PO đang được mở chi tiết
  const activePO = pos.find(p => p.id === activePOId) || null;

  // Tạo mới một hồ sơ PO từ các dòng đã chọn và lưu vào PostgreSQL
  const createPO = useCallback(async ({
    poNumber,
    date,
    requester,
    note,
    payGroup = 'A',
    source = '',
    selectedRows = []
  }) => {
    if (!selectedRows || selectedRows.length === 0) {
      throw new Error('Chưa có dòng nào được chọn để tạo hồ sơ.');
    }

    const finalPO = poNumber || generateNextPONumber(pos);

    // 1. Thử lưu vào Backend API trước
    let createdRecord = null;
    try {
      const apiPayload = {
        po_number: finalPO,
        date: date || new Date().toISOString().slice(0, 10),
        requester: requester || 'Nguyễn Văn A',
        note: note || '',
        source: source || 'File Excel nhập khẩu',
        items: selectedRows.map(r => ({
          stt: r.stt,
          date: r.date,
          request_date: r.date,
          unit: r.unit,
          supplier: r.supplier,
          item: r.item,
          qty: r.qty,
          spec: r.spec,
          price: r.price,
          amount: r.amount,
          purpose: r.purpose,
          msp: r.msp,
          payGroup: r.payGroup
        }))
      };

      const res = await poApi.createPO(apiPayload);
      if (res.success && res.data) {
        createdRecord = normalizeBackendPO(res.data);
      }
    } catch (err) {
      console.warn('[usePOManagement] Lưu Backend API lỗi, lưu Local fallback:', err.message);
    }

    // Nếu không kết nối được backend, fallback sang local object
    if (!createdRecord) {
      createdRecord = {
        id: `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        po: finalPO,
        po_number: finalPO,
        date: date || new Date().toISOString().slice(0, 10),
        requester: requester || 'Nguyễn Văn A',
        note: note || '',
        payGroup: payGroup || 'A',
        source: source || 'File Excel nhập khẩu',
        items: JSON.parse(JSON.stringify(selectedRows)),
        status: 'Chờ trình ký',
        created: new Date().toISOString(),
        updated: new Date().toLocaleString('vi-VN'),
        receivedQty: 0,
        logs: [
          {
            time: new Date().toLocaleString('vi-VN'),
            text: `Khởi tạo hồ sơ ${finalPO} với ${selectedRows.length} dòng hàng hóa từ ${source || 'Excel'}`
          }
        ]
      };
      storageService.addPO(createdRecord);
    }

    // Cập nhật state
    await refreshPOs();
    setActivePOId(createdRecord.id);

    // Tự động xuất 01 File Excel gồm 02 Sheet chuẩn
    try {
      setIsExporting(true);
      await excelExporter.exportBothExcelFiles(createdRecord);
    } catch (e) {
      console.error('Lỗi tự động xuất 01 file Excel:', e);
    } finally {
      setIsExporting(false);
    }

    return createdRecord;
  }, [pos, refreshPOs]);

  // Cập nhật trạng thái quy trình
  const updateStatus = useCallback(async (poId, nextStatus, comment = '') => {
    try {
      await poApi.updatePO(poId, { status: nextStatus, note: comment });
    } catch (e) {
      storageService.updatePO(poId, { status: nextStatus });
    }
    await refreshPOs();
  }, [refreshPOs]);

  // Cập nhật thông tin đặt hàng / nhận hàng
  const updateOrderInfo = useCallback(async (poId, orderData) => {
    try {
      await poApi.updatePO(poId, orderData);
    } catch (e) {
      storageService.updatePO(poId, orderData);
    }
    await refreshPOs();
  }, [refreshPOs]);

  // Xuất 1 file Excel gồm 02 sheet cho hồ sơ bất kỳ
  const exportPO = useCallback(async (poId) => {
    const po = pos.find(p => p.id === poId);
    if (!po) throw new Error('Không tìm thấy hồ sơ PO.');

    setIsExporting(true);
    try {
      await excelExporter.exportBothExcelFiles(po);
    } finally {
      setIsExporting(false);
    }
  }, [pos]);

  // Xóa hồ sơ
  const deletePO = useCallback(async (poId) => {
    try {
      await poApi.deletePO(poId);
    } catch (e) {
      storageService.deletePO(poId);
    }
    if (activePOId === poId) setActivePOId(null);
    await refreshPOs();
  }, [activePOId, refreshPOs]);

  return {
    pos,
    activePO,
    activePOId,
    setActivePOId,
    isExporting,
    isLoading,
    apiOnline,
    refreshPOs,
    createPO,
    updateStatus,
    updateOrderInfo,
    exportPO,
    deletePO,
    generateNextPO: () => generateNextPONumber(pos)
  };
}
