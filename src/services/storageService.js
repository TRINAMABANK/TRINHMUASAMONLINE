/**
 * Service lưu trữ hồ sơ và lịch sử xử lý cho hệ thống QTTS
 */

const STORAGE_KEY = 'qtts_procurement_records_v2';

let inMemoryPOs = [];

export const storageService = {
  /**
   * Lấy toàn bộ danh sách hồ sơ PO
   * @returns {Array}
   */
  getPOs() {
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
      }
      return inMemoryPOs;
    } catch (e) {
      console.error('Lỗi đọc storage:', e);
      return [];
    }
  },

  /**
   * Lưu toàn bộ danh sách hồ sơ PO
   * @param {Array} pos 
   */
  savePOs(pos) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } else {
        inMemoryPOs = pos;
      }
    } catch (e) {
      console.error('Lỗi ghi storage:', e);
    }
  },

  /**
   * Thêm mới một hồ sơ PO vào đầu danh sách
   * @param {object} poRecord 
   */
  addPO(poRecord) {
    const list = this.getPOs();
    list.unshift(poRecord);
    this.savePOs(list);
    return list;
  },

  /**
   * Cập nhật một hồ sơ PO
   * @param {string} id 
   * @param {object} updates 
   */
  updatePO(id, updates) {
    const list = this.getPOs();
    const index = list.findIndex(p => p.id === id);
    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...updates,
        updated: new Date().toLocaleString('vi-VN')
      };
      this.savePOs(list);
      return list[index];
    }
    return null;
  },

  /**
   * Xóa một hồ sơ PO
   * @param {string} id 
   */
  deletePO(id) {
    const list = this.getPOs().filter(p => p.id !== id);
    this.savePOs(list);
    return list;
  },

  /**
   * Thêm một mục nhật ký vào hồ sơ PO
   * @param {string} id 
   * @param {string} actionText 
   */
  addLog(id, actionText) {
    const list = this.getPOs();
    const po = list.find(p => p.id === id);
    if (po) {
      po.logs = po.logs || [];
      po.logs.unshift({
        time: new Date().toLocaleString('vi-VN'),
        text: actionText
      });
      po.updated = new Date().toLocaleString('vi-VN');
      this.savePOs(list);
      return po;
    }
    return null;
  },

  /**
   * Xóa toàn bộ dữ liệu
   */
  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('qtts_po_counter');
  },

  /**
   * Xuất dữ liệu ra file JSON backup
   */
  exportBackup() {
    const data = this.getPOs();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_QTTS_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
