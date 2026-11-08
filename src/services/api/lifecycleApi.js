import { apiClient } from './apiClient.js';

export const lifecycleApi = {
  async getDashboardKPIs(filters = {}) {
    return apiClient.get('/lifecycles/dashboard/kpis', filters);
  },

  async getPoTimeline(poId) {
    return apiClient.get(`/lifecycles/${poId}/timeline`);
  }
};

export const deliveryApi = {
  async confirmOrder(poId, notes = '') {
    return apiClient.post(`/deliveries/${poId}/confirm-order`, { notes });
  },

  async updateExpectedDate(poId, expectedDate, reason = '') {
    return apiClient.post(`/deliveries/${poId}/expected-date`, { expected_date: expectedDate, reason });
  },

  async getExpectedDateHistory(poId) {
    return apiClient.get(`/deliveries/${poId}/expected-date/history`);
  },

  async dispatchDelivery(poId, deliveryData) {
    return apiClient.post(`/deliveries/${poId}/dispatch`, deliveryData);
  }
};

export const receiptApi = {
  async confirmReceipt(poId, receiptData) {
    return apiClient.post(`/receipts/${poId}/confirm`, receiptData);
  },

  async resolveDiscrepancy(receiptId, resolutionNote, closePo = false) {
    return apiClient.post(`/receipts/resolve-discrepancy/${receiptId}`, { resolution_note: resolutionNote, close_po: closePo });
  },

  async getReceipts(poId) {
    return apiClient.get(`/receipts/${poId}`);
  }
};

export const masterDataApi = {
  async getDepartments() {
    return apiClient.get('/departments');
  },

  async getSuppliers() {
    return apiClient.get('/suppliers');
  },

  async getNotifications() {
    return apiClient.get('/notifications');
  },

  async markNotificationRead(id) {
    return apiClient.put(`/notifications/${id}/read`);
  },

  async getAuditLogs() {
    return apiClient.get('/notifications/audit-logs');
  }
};
