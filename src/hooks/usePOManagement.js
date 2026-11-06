import { useState, useEffect, useCallback } from 'react';
import { storageService } from '../services/storageService.js';
import { generateNextPONumber } from '../services/poGenerator.js';
import { excelExporter } from '../services/excelExporter.js';
import { WORKFLOW_STAGES } from '../utils/constants.js';

export function usePOManagement() {
  const [pos, setPOs] = useState([]);
  const [activePOId, setActivePOId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Load danh sách ban đầu từ storage
  const refreshPOs = useCallback(() => {
    const list = storageService.getPOs();
    setPOs(list);
  }, []);

  useEffect(() => {
    refreshPOs();
  }, [refreshPOs]);

  // Hồ sơ PO đang được mở chi tiết
  const activePO = pos.find(p => p.id === activePOId) || null;

  // Tạo mới một hồ sơ PO từ các dòng đã chọn
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

    const currentPOs = storageService.getPOs();
    const finalPO = poNumber || generateNextPONumber(currentPOs);

    const newPO = {
      id: `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      po: finalPO,
      date: date || new Date().toISOString().slice(0, 10),
      requester: requester || 'Nguyễn Văn A',
      note: note || '',
      payGroup: payGroup || 'A',
      source: source || 'File Excel nhập khẩu',
      items: JSON.parse(JSON.stringify(selectedRows)),
      status: 'Chờ trình ký', // Trạng thái mặc định sau khi tạo
      created: new Date().toISOString(),
      updated: new Date().toLocaleString('vi-VN'),
      receivedQty: 0,
      orderSupplier: selectedRows[0]?.supplier || '',
      orderNo: '',
      orderDate: '',
      logs: [
        {
          time: new Date().toLocaleString('vi-VN'),
          text: `Khởi tạo hồ sơ ${finalPO} với ${selectedRows.length} dòng hàng hóa từ ${source || 'Excel'}`
        }
      ]
    };

    const updatedList = storageService.addPO(newPO);
    setPOs(updatedList);
    setActivePOId(newPO.id);

    // Tự động xuất 2 file Excel
    try {
      setIsExporting(true);
      await excelExporter.exportBothExcelFiles(newPO);
    } catch (e) {
      console.error('Lỗi tự động xuất 2 file:', e);
    } finally {
      setIsExporting(false);
    }

    return newPO;
  }, []);

  // Chuyển đổi trạng thái quy trình (Workflow)
  const updateStatus = useCallback((poId, nextStatus, comment = '') => {
    const po = pos.find(p => p.id === poId);
    if (!po) return null;

    const logText = comment 
      ? `Chuyển trạng thái sang "${nextStatus}": ${comment}`
      : `Chuyển trạng thái sang "${nextStatus}"`;

    storageService.addLog(poId, logText);
    const updated = storageService.updatePO(poId, { status: nextStatus });
    refreshPOs();
    return updated;
  }, [pos, refreshPOs]);

  // Cập nhật thông tin đặt hàng & nhận hàng
  const updateOrderInfo = useCallback((poId, orderData) => {
    storageService.addLog(poId, 'Cập nhật thông tin đặt hàng / nhận hàng');
    const updated = storageService.updatePO(poId, orderData);
    refreshPOs();
    return updated;
  }, [refreshPOs]);

  // Xuất 2 file Excel cho một hồ sơ bất kỳ
  const exportPO = useCallback(async (poId) => {
    const po = pos.find(p => p.id === poId);
    if (!po) throw new Error('Không tìm thấy hồ sơ PO.');

    setIsExporting(true);
    try {
      await excelExporter.exportBothExcelFiles(po);
      storageService.addLog(poId, 'Xuất lại bộ 2 file Excel: Bảng trình ký & Bảng kê');
      refreshPOs();
    } finally {
      setIsExporting(false);
    }
  }, [pos, refreshPOs]);

  // Xóa hồ sơ
  const deletePO = useCallback((poId) => {
    storageService.deletePO(poId);
    if (activePOId === poId) setActivePOId(null);
    refreshPOs();
  }, [activePOId, refreshPOs]);

  // Nạp 3 hồ sơ mẫu để thử nghiệm nhanh
  const seedDemoData = useCallback(() => {
    const existing = storageService.getPOs();
    const demoItems = [
      {
        unit: 'Chi Nhánh Hà Nội',
        supplier: 'Công ty Viễn Thông Quốc Tế FTI',
        item: 'MÁY IN LASER BROTHER HL - L6210DW CÔNG SUẤT LỚN',
        qty: 2,
        spec: 'CÁI',
        price: 10315000,
        amount: 20630000,
        purpose: 'Trang bị thay thế máy in cũ đã hỏng tại phòng kế toán',
        msp: '801BNPT20260425113035',
        selected: true
      },
      {
        unit: 'Chi nhánh Thanh Hóa',
        supplier: 'CTY FTI',
        item: 'MÁY TÍNH ĐỂ BÀN (PC) LENOVO ThinkCentre Neo 50s Gen 6 U3 Ram 16GB SSD 512GB',
        qty: 3,
        spec: 'BỘ',
        price: 26811000,
        amount: 80433000,
        purpose: 'Trang bị cho Onebank Bình Minh',
        msp: '803BNPT20261020150645',
        selected: true
      },
      {
        unit: 'PGD Đồng Xuân',
        supplier: 'HANG TIN',
        item: 'MÁY ĐẾM TIỀN TIANYU T18 & BỤC ĐỂ MÁY ĐẾM TIỀN CHUYÊN DỤNG',
        qty: 4,
        spec: 'BỘ',
        price: 7290000,
        amount: 29160000,
        purpose: 'Phục vụ hoạt động kiểm ngân quầy giao dịch',
        msp: '806BNPT20260521154956',
        selected: true
      }
    ];

    const demos = [
      {
        status: 'Chờ trình ký',
        title: 'Hồ sơ trang bị máy in CN Hà Nội',
        items: [demoItems[0]]
      },
      {
        status: 'Đã duyệt',
        title: 'Hồ sơ trang bị máy tính Onebank Thanh Hóa',
        items: [demoItems[1]]
      },
      {
        status: 'Đã đặt hàng',
        title: 'Hồ sơ máy đếm tiền PGD Đồng Xuân',
        items: [demoItems[2]],
        orderSupplier: 'HANG TIN',
        orderNo: 'ORD-2026-HT-09',
        orderDate: new Date().toISOString().slice(0, 10),
      }
    ];

    demos.forEach(d => {
      const poNum = generateNextPONumber(storageService.getPOs());
      const po = {
        id: `demo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        po: poNum,
        date: new Date().toISOString().slice(0, 10),
        requester: 'Quản trị viên QTTS',
        note: d.title,
        payGroup: 'A',
        source: 'Dữ liệu mẫu thử nghiệm',
        items: d.items,
        status: d.status,
        created: new Date().toISOString(),
        updated: new Date().toLocaleString('vi-VN'),
        receivedQty: 0,
        orderSupplier: d.orderSupplier || d.items[0].supplier,
        orderNo: d.orderNo || '',
        orderDate: d.orderDate || '',
        logs: [
          { time: new Date().toLocaleString('vi-VN'), text: 'Khởi tạo hồ sơ mẫu' }
        ]
      };
      storageService.addPO(po);
    });

    refreshPOs();
  }, [refreshPOs]);

  return {
    pos,
    activePO,
    activePOId,
    setActivePOId,
    isExporting,
    refreshPOs,
    createPO,
    updateStatus,
    updateOrderInfo,
    exportPO,
    deletePO,
    seedDemoData,
    generateNextPO: () => generateNextPONumber(pos)
  };
}
