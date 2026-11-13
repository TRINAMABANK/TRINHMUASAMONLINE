import { apiClient } from './apiClient.js';

export const poApi = {
  async getPOs(filters = {}) {
    return apiClient.get('/purchase-orders', filters);
  },

  async getPOById(id) {
    return apiClient.get(`/purchase-orders/${id}`);
  },

  async createPO(data) {
    return apiClient.post('/purchase-orders', data);
  },

  async updatePO(id, data) {
    return apiClient.put(`/purchase-orders/${id}`, data);
  },

  async deletePO(id) {
    return apiClient.delete(`/purchase-orders/${id}`);
  },

  async submitPO(id) {
    return apiClient.post(`/purchase-orders/${id}/submit`);
  },

  async approvePO(id, comment = '') {
    return apiClient.post(`/purchase-orders/${id}/approve`, { comment });
  },

  async rejectPO(id, reason = '') {
    return apiClient.post(`/purchase-orders/${id}/reject`, { reason });
  },

  async orderPO(id, data = {}) {
    return apiClient.post(`/purchase-orders/${id}/order`, data);
  },

  async deliverPO(id, data = {}) {
    return apiClient.post(`/purchase-orders/${id}/deliver`, data);
  },

  async receiptPO(id, data = {}) {
    return apiClient.post(`/purchase-orders/${id}/receipt`, data);
  },

  async acceptPaymentBatch(data) {
    return apiClient.post('/purchase-orders/payment-batches/accept', data);
  },

  // Cổng Tra cứu Đơn vị (Unit Portal API)
  async getUnitDashboardStats(unitId = '') {
    return apiClient.get('/units/dashboard-stats', unitId ? { unit_id: unitId } : {});
  },

  async getUnitSearchItems(filters = {}) {
    return apiClient.get('/units/search-items', filters);
  },

  async confirmUnitReceipt(data) {
    return apiClient.post('/units/confirm-receipt', data);
  }
};
