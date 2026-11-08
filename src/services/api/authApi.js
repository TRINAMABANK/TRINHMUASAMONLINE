import { apiClient } from './apiClient.js';

export const authApi = {
  async login(email, password) {
    const res = await apiClient.post('/auth/login', { email, password });
    if (res.data?.token) {
      apiClient.setToken(res.data.token);
    }
    return res;
  },

  async switchRole(role) {
    const res = await apiClient.post('/auth/switch-role', { role });
    if (res.data?.token) {
      apiClient.setToken(res.data.token);
    }
    return res;
  },

  async getMe() {
    return apiClient.get('/auth/me');
  },

  async getUsers() {
    return apiClient.get('/users');
  },

  logout() {
    apiClient.setToken(null);
  }
};
