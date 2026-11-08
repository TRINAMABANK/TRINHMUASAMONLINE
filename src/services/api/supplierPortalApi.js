import { apiClient } from './apiClient.js';

export const supplierInvitationApi = {
  // Lấy danh sách quản lý gửi đơn của tất cả NCC trong PO
  async getPoSupplierManagement(poId) {
    return apiClient.get(`/purchase-orders/${poId}/supplier-invitations`);
  },

  // Tạo lời mời đặt hàng qua link riêng cho NCC
  async generateInvitation(data) {
    return apiClient.post('/supplier-invitations/generate', data);
  },

  // ADMIN xác nhận đã gửi email thành công
  async confirmSent(invitationId) {
    return apiClient.post(`/supplier-invitations/${invitationId}/confirm-sent`, {});
  },

  // Gửi lại link riêng
  async resend(invitationId) {
    return apiClient.post(`/supplier-invitations/${invitationId}/resend`, {});
  },

  // Thu hồi link riêng
  async revoke(invitationId) {
    return apiClient.post(`/supplier-invitations/${invitationId}/revoke`, {});
  }
};

export const supplierPortalApi = {
  // Cổng đối tác truy cập qua secure token
  async getPortalData(token) {
    return apiClient.get(`/supplier-portal/access/${token}`);
  },

  // Đối tác xác nhận PO & ngày dự kiến giao
  async confirmPo(token, data) {
    return apiClient.post(`/supplier-portal/confirm/${token}`, data);
  },

  // Đối tác xác nhận xuất kho / giao hàng
  async dispatchDelivery(token, data) {
    return apiClient.post(`/supplier-portal/dispatch/${token}`, data);
  }
};
