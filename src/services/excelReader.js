import * as XLSX from 'xlsx';
import { COLUMN_DEFINITIONS } from '../utils/constants.js';
import { normalizeText, extractMSP } from '../utils/validation.js';
import { formatExcelDate } from '../utils/dateUtils.js';
import { parseCurrency } from '../utils/currencyUtils.js';

/**
 * Service đọc và tiền xử lý file Excel phiếu thô
 */
export const excelReader = {
  /**
   * Đọc file Excel từ ArrayBuffer hoặc File object
   * @param {File} file 
   * @returns {Promise<{ headers: string[], rows: object[], fileName: string, autoMapping: object, warnings: string[] }>}
   */
  async readExcelFile(file) {
    if (!file) throw new Error('Không có file được chọn.');

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, {
      type: 'array',
      cellDates: true,
      raw: true
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('File Excel rỗng, không tìm thấy sheet dữ liệu.');
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Chuyển worksheet thành mảng 2 chiều
    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: true
    });

    if (!rawRows || rawRows.length === 0) {
      throw new Error('Không có dữ liệu trong sheet đầu tiên.');
    }

    // Tìm dòng tiêu đề (header): Dòng đầu tiên có ít nhất 2 ô không rỗng
    let headerRowIndex = rawRows.findIndex(r => 
      Array.isArray(r) && r.filter(v => String(v ?? '').trim().length > 0).length >= 2
    );

    if (headerRowIndex < 0) {
      throw new Error('Không tìm thấy dòng tiêu đề (Header) của bảng dữ liệu.');
    }

    const rawHeaders = rawRows[headerRowIndex].map((h, i) => 
      String(h || `Cột ${i + 1}`).trim()
    );

    // Dữ liệu bắt đầu từ sau dòng tiêu đề
    const dataRows = rawRows.slice(headerRowIndex + 1).filter(r => 
      Array.isArray(r) && r.some(v => String(v ?? '').trim().length > 0)
    );

    // Tự động nhận diện mapping theo từ khóa aliases
    const autoMapping = {};
    COLUMN_DEFINITIONS.forEach(def => {
      const matchedIdx = rawHeaders.findIndex(header => {
        const normH = normalizeText(header);
        return def.aliases.some(alias => normH.includes(normalizeText(alias)));
      });
      autoMapping[def.key] = matchedIdx >= 0 ? matchedIdx : -1;
    });

    // Kiểm tra các cột bắt buộc: 'item' (Nội dung) và 'qty' (Số lượng)
    const missingRequired = [];
    if (autoMapping.item === -1) missingRequired.push('Nội dung / Tên hàng hóa');
    if (autoMapping.qty === -1) missingRequired.push('Số lượng (SL)');

    if (missingRequired.length > 0) {
      throw new Error(`File Excel thiếu các cột bắt buộc: ${missingRequired.join(', ')}. Vui lòng kiểm tra lại tiêu đề file.`);
    }

    // Parse từng dòng dữ liệu theo autoMapping
    const parsedRows = dataRows.map((r, idx) => {
      const getVal = (key) => {
        const colIdx = autoMapping[key];
        return (colIdx !== undefined && colIdx >= 0 && colIdx < r.length) ? r[colIdx] : '';
      };

      const rawItem = String(getVal('item') || '').trim();
      const rawQty = parseCurrency(getVal('qty'));
      const rawPrice = parseCurrency(getVal('price'));
      let rawAmount = parseCurrency(getVal('amount'));

      // Tự động tính thành tiền nếu thiếu hoặc = 0
      if (!rawAmount && rawQty > 0 && rawPrice > 0) {
        rawAmount = rawQty * rawPrice;
      }

      const rawPurpose = String(getVal('purpose') || '').trim();
      // Tìm mã MSP gốc từ cột MSP hoặc trong nội dung / mục đích
      let msp = String(getVal('msp') || '').trim();
      if (!msp) {
        msp = extractMSP(rawPurpose) || extractMSP(rawItem);
      }

      const rawDate = getVal('date');
      const formattedDate = formatExcelDate(rawDate);
      const rawUnit = String(getVal('unit') || '').trim();
      const normUnit = rawUnit.toLowerCase();
      const isHO = normUnit.includes('hội sở') || normUnit.includes('hoi so') || normUnit.includes('khối') || normUnit.includes('ban') || normUnit.includes('trung tâm');

      return {
        id: `row_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        stt: idx + 1,
        date: formattedDate,
        unit: rawUnit,
        supplier: String(getVal('supplier') || '').trim(),
        item: rawItem,
        qty: rawQty,
        spec: String(getVal('spec') || '').trim(),
        price: rawPrice,
        amount: rawAmount,
        purpose: rawPurpose,
        msp: msp,
        payGroup: isHO ? 'A' : 'B', // A: Hội sở thanh toán, B: Đơn vị thanh toán
        statusDV: String(getVal('statusDV') || '').trim(),
        statusHO: String(getVal('statusHO') || '').trim(),
        selected: true, // Mặc định được tick chọn
      };
    }).filter(r => r.item.length > 0); // Lọc bỏ dòng không có tên hàng

    return {
      fileName: file.name,
      headers: rawHeaders,
      rows: parsedRows,
      autoMapping,
      totalRawRows: dataRows.length,
      validRowsCount: parsedRows.length
    };
  }
};
