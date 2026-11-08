/**
 * API Client dùng chung cho toàn bộ ứng dụng TRINHMUASAMONLINE
 * Tự động gắn Bearer Token và xử lý lỗi / mất kết nối
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  getToken() {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('qtts_jwt_token') || '';
      }
    } catch (e) {
      return '';
    }
    return '';
  }

  setToken(token) {
    try {
      if (typeof localStorage !== 'undefined') {
        if (token) {
          localStorage.setItem('qtts_jwt_token', token);
        } else {
          localStorage.removeItem('qtts_jwt_token');
        }
      }
    } catch (e) {}
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // Token hết hạn hoặc không hợp lệ
        console.warn('[API Client] Phiên làm việc hết hạn hoặc chưa đăng nhập.');
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.message || `Lỗi máy chủ HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        console.error('[API Client] Không thể kết nối đến máy chủ Backend tại:', url);
        const netErr = new Error('Không thể kết nối đến máy chủ Backend API (http://localhost:5000). Vui lòng kiểm tra lại dịch vụ backend.');
        netErr.isNetworkError = true;
        throw netErr;
      }
      throw err;
    }
  }

  get(endpoint, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return this.request(`${endpoint}${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
