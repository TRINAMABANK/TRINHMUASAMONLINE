import { useState, useEffect, useCallback } from 'react';
import { poApi } from '../services/api/poApi.js';
import { storageService } from '../services/storageService.js';
import { generateNextPONumber } from '../services/poGenerator.js';
import { excelExporter } from '../services/excelExporter.js';
import { calculatePOTimings } from '../utils/timingUtils.js';

export function usePOManagement() {
  const [pos, setPOs] = useState([]);
  const [activePOId, setActivePOId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);

  // Chuyển đổi dữ liệu từ Backend PostgreSQL sang định dạng chuẩn của giao diện
  const normalizeBackendPO = (p) => {
    const rawItems = (p.items || []).map(it => ({
      id: it.id,
      stt: it.stt,
      date: it.request_date || it.date || '',
      request_date: it.request_date || it.date || '',
      unit: it.unit_name || it.unit || 'Hội sở',
      supplier: it.supplier_name || it.supplier || 'Chưa chỉ định NCC',
      item: it.item_name || it.item || 'Sản phẩm mua sắm',
      qty: Number(it.qty) || 1,
      spec: it.spec || 'CÁI',
      price: Number(it.unit_price || it.price) || 0,
      amount: Number(it.amount) || ((Number(it.qty) || 1) * (Number(it.price) || 0)),
      purpose: it.purpose || '',
      msp: it.msp || '',
      payGroup: it.pay_group || it.payGroup || null,
      deliveredQty: Number(it.delivered_qty || it.deliveredQty) || 0,
      receivedQty: Number(it.received_qty || it.receivedQty) || 0,
      deliveryStatus: it.delivery_status || 'Chưa giao',
      receiptStatus: it.receipt_status || 'Chưa nhận',
      selected: it.selected !== false
    }));

    const repUnit = p.representative_unit || rawItems[0]?.unit || 'Hội sở';
    const timings = p.timings || calculatePOTimings(p);

    let statusText = 'Chờ trình ký';
    if (p.delivery_status === 'HOAN_TAT' || p.po_status === 'HOAN_TAT') {
      statusText = 'Hoàn tất';
    } else if (p.delivery_status === 'DA_NHAN_MOT_PHAN') {
      statusText = 'Chờ đơn vị xác nhận';
    } else if (p.delivery_status === 'DANG_GIAO') {
      statusText = 'Đang giao hàng';
    } else if (p.po_status === 'DA_DAT_HANG' || p.po_status === 'DOI_TAC_XAC_NHAN') {
      statusText = 'Đã đặt hàng';
    } else if (p.submission_status === 'DA_DUYET') {
      statusText = 'Đã duyệt';
    } else if (p.submission_status === 'TU_CHOI') {
      statusText = 'Từ chối';
    } else if (p.submission_status === 'DANG_TRINH_KY' || p.submission_status === 'CHO_DUYET') {
      statusText = 'Đang trình ký';
    }

    return {
      id: p.id,
      po: p.po_number || p.po,
      po_number: p.po_number || p.po,
      date: p.order_date ? new Date(p.order_date).toISOString().slice(0, 10) : p.date,
      requester: p.requester_name || p.requester || 'Nguyễn Văn A',
      representative_unit: repUnit,
      note: p.note || '',
      submission_status: p.submission_status || 'KHOI_TAO',
      po_status: p.po_status || 'DA_TAO_PO',
      delivery_status: p.delivery_status || 'CHUA_GIAO',
      current_stage: p.current_stage || 'PHIEU_TRINH_XUAT',
      is_overdue: p.is_overdue || false,
      status: statusText,
      submitted_at: p.submitted_at || null,
      approved_at: p.approved_at || null,
      rejected_at: p.rejected_at || null,
      ordered_at: p.ordered_at || null,
      completed_at: p.completed_at || null,
      current_round: p.current_round || 1,
      timings: timings,
      approval_duration: timings.approvalDurationText,
      items: rawItems,
      approvals: p.approvals || [],
      suppliers: p.suppliers || [],
      email_logs: p.email_logs || [],
      deliveries: p.deliveries || [],
      receipts: p.receipts || [],
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
        storageService.savePOs(normalized);
        setApiOnline(true);
        return normalized;
      }
    } catch (e) {
      console.warn('[usePOManagement] Không thể tải từ API Backend, chuyển sang LocalStorage fallback:', e.message);
      setApiOnline(false);
      const list = storageService.getPOs().map(normalizeBackendPO);
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
    selectedRows = [],
    customLog = ''
  }) => {
    if (!selectedRows || selectedRows.length === 0) {
      throw new Error('Chưa có dòng nào được chọn để tạo hồ sơ.');
    }

    const finalPO = poNumber || generateNextPONumber(pos);
    const defaultLogText = customLog || `Khởi tạo hồ sơ ${finalPO} với ${selectedRows.length} dòng hàng hóa từ ${source || 'Excel'}`;

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
        storageService.addLog(createdRecord.id, defaultLogText);
      }
    } catch (err) {
      console.warn('[usePOManagement] Lưu Backend API lỗi, lưu Local fallback:', err.message);
    }

    // Nếu không kết nối được backend, fallback sang local object
    if (!createdRecord) {
      const repUnit = selectedRows[0]?.unit || 'Hội sở';
      createdRecord = {
        id: `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        po: finalPO,
        po_number: finalPO,
        date: date || new Date().toISOString().slice(0, 10),
        requester: requester || 'Nguyễn Văn A',
        representative_unit: repUnit,
        note: note || '',
        payGroup: payGroup || 'A',
        source: source || 'File Excel nhập khẩu',
        items: JSON.parse(JSON.stringify(selectedRows)),
        status: 'Chờ trình ký',
        submission_status: 'KHOI_TAO',
        po_status: 'DA_TAO_PO',
        delivery_status: 'CHUA_GIAO',
        current_round: 1,
        created: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated: new Date().toLocaleString('vi-VN'),
        receivedQty: 0,
        logs: [
          {
            time: new Date().toLocaleString('vi-VN'),
            text: defaultLogText
          }
        ]
      };
      createdRecord.timings = calculatePOTimings(createdRecord);
      createdRecord.approval_duration = createdRecord.timings.approvalDurationText;
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

  // Gửi trình ký hồ sơ
  const submitApproval = useCallback(async (poId) => {
    try {
      await poApi.submitPO(poId);
    } catch (e) {
      const now = new Date().toISOString();
      storageService.updatePO(poId, {
        submission_status: 'DANG_TRINH_KY',
        status: 'Đang trình ký',
        submitted_at: now
      });
      storageService.addLog(poId, 'Gửi trình ký hồ sơ');
    }
    await refreshPOs();
  }, [refreshPOs]);

  // Phê duyệt hồ sơ
  const approvePO = useCallback(async (poId, comment = '') => {
    try {
      await poApi.approvePO(poId, comment);
    } catch (e) {
      const now = new Date().toISOString();
      storageService.updatePO(poId, {
        submission_status: 'DA_DUYET',
        status: 'Đã duyệt',
        approved_at: now
      });
      storageService.addLog(poId, `Phê duyệt hồ sơ: ${comment || 'Đã duyệt'}`);
    }
    await refreshPOs();
  }, [refreshPOs]);

  // Từ chối / Trả lại hồ sơ
  const rejectPO = useCallback(async (poId, reason = '') => {
    try {
      await poApi.rejectPO(poId, reason);
    } catch (e) {
      const now = new Date().toISOString();
      const current = pos.find(p => p.id === poId);
      storageService.updatePO(poId, {
        submission_status: 'TU_CHOI',
        status: 'Từ chối',
        rejected_at: now,
        current_round: (current?.current_round || 1) + 1
      });
      storageService.addLog(poId, `Từ chối hồ sơ: ${reason || 'Yêu cầu rà soát lại'}`);
    }
    await refreshPOs();
  }, [pos, refreshPOs]);

  // Phát hành đơn đặt hàng
  const orderPO = useCallback(async (poId, orderData = {}) => {
    try {
      await poApi.orderPO(poId, orderData);
    } catch (e) {
      const now = new Date().toISOString();
      storageService.updatePO(poId, {
        po_status: 'DA_DAT_HANG',
        status: 'Đã đặt hàng',
        ordered_at: now,
        orderSupplier: orderData.orderSupplier,
        orderNo: orderData.orderNo
      });
      storageService.addLog(poId, `Phát hành đơn đặt hàng cho NCC: ${orderData.orderSupplier || 'NCC'}`);
    }
    await refreshPOs();
  }, [refreshPOs]);

  // Giao hàng
  const deliverPO = useCallback(async (poId, deliveryData = {}) => {
    try {
      await poApi.deliverPO(poId, deliveryData);
    } catch (e) {
      storageService.updatePO(poId, {
        delivery_status: 'DANG_GIAO',
        status: 'Đang giao hàng'
      });
      storageService.addLog(poId, `Đã xuất hàng giao: ${deliveryData.carrier || 'Đơn vị vận chuyển'}`);
    }
    await refreshPOs();
  }, [refreshPOs]);

  // Xác nhận nhận hàng
  const receiptPO = useCallback(async (poId, receiptData = {}) => {
    try {
      await poApi.receiptPO(poId, receiptData);
    } catch (e) {
      const current = pos.find(p => p.id === poId);
      const totalQty = (current?.items || []).reduce((s, x) => s + (Number(x.qty) || 0), 0);
      const newReceived = (Number(current?.receivedQty) || 0) + (Number(receiptData.quantity) || totalQty);
      const isAll = newReceived >= totalQty;

      storageService.updatePO(poId, {
        receivedQty: newReceived,
        delivery_status: isAll ? 'HOAN_TAT' : 'DA_NHAN_MOT_PHAN',
        po_status: isAll ? 'HOAN_TAT' : current?.po_status,
        status: isAll ? 'Hoàn tất' : 'Chờ đơn vị xác nhận'
      });
      storageService.addLog(poId, `Xác nhận nhận hàng (${newReceived}/${totalQty} SP). ${isAll ? 'Hoàn tất hồ sơ.' : ''}`);
    }
    await refreshPOs();
  }, [pos, refreshPOs]);

  // Cập nhật trạng thái quy trình chung
  const updateStatus = useCallback(async (poId, nextStatus, comment = '') => {
    if (nextStatus === 'Đang trình ký' || nextStatus === 'DANG_TRINH_KY') {
      return await submitApproval(poId);
    }
    if (nextStatus === 'Đã duyệt' || nextStatus === 'DA_DUYET') {
      return await approvePO(poId, comment);
    }
    if (nextStatus === 'Từ chối' || nextStatus === 'TU_CHOI') {
      return await rejectPO(poId, comment);
    }
    if (nextStatus === 'Đã đặt hàng' || nextStatus === 'DA_DAT_HANG') {
      return await orderPO(poId, { note: comment });
    }
    if (nextStatus === 'Đang giao hàng' || nextStatus === 'DANG_GIAO') {
      return await deliverPO(poId);
    }
    if (nextStatus === 'Hoàn tất' || nextStatus === 'HOAN_TAT') {
      return await receiptPO(poId, {});
    }

    try {
      await poApi.updatePO(poId, { status: nextStatus, note: comment });
    } catch (e) {
      storageService.updatePO(poId, { status: nextStatus });
    }
    await refreshPOs();
  }, [submitApproval, approvePO, rejectPO, orderPO, deliverPO, receiptPO, refreshPOs]);

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
    submitApproval,
    approvePO,
    rejectPO,
    orderPO,
    deliverPO,
    receiptPO,
    updateStatus,
    updateOrderInfo,
    exportPO,
    deletePO,
    generateNextPO: () => generateNextPONumber(pos)
  };
}
