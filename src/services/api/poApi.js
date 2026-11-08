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

  async acceptPaymentBatch(data) {
    return apiClient.post('/purchase-orders/payment-batches/accept', data);
  }
};
