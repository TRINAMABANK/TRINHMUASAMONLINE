import React, { useState } from 'react';
import { authApi } from '../services/api/authApi.js';
import { ShieldCheck, Lock, User, CheckCircle2, AlertCircle, X, Building } from 'lucide-react';

export function AdminLoginModal({ isOpen, onClose, onSuccess }) {
  const [username, setUsername] = useState('Admin');
  const [password, setPassword] = useState('Admin2026');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await authApi.login(username, password);
      if (res.success && res.data?.user) {
        if (onSuccess) {
          onSuccess(res.data.user);
        }
        if (onClose) onClose();
      } else {
        setErrorMessage(res.message || 'Đăng nhập không thành công.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Lỗi kết nối máy chủ xác thực.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000, background: 'rgba(15, 23, 42, 0.75)' }}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px', width: '92%', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #003366 0%, #001f3f 100%)',
          color: '#ffffff',
          padding: '24px 24px 20px',
          position: 'relative',
          textAlign: 'center'
        }}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          )}

          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#FFD200',
            color: '#003366',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: '0 4px 14px rgba(255, 210, 0, 0.4)'
          }}>
            <ShieldCheck size={32} />
          </div>

          <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800, letterSpacing: '0.5px' }}>
            CỔNG QUẢN TRỊ TRINHMUASAM
          </h2>
          <p style={{ margin: 0, fontSize: '12.5px', opacity: 0.85 }}>
            Nam A Bank • Quản Trị Mua Sắm & Vòng Đời PO
          </p>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', background: '#ffffff' }}>
          {errorMessage && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              padding: '10px 14px',
              marginBottom: '16px',
              color: '#991b1b',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Tài khoản Quản trị:
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Admin"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
              Nhập: <strong>Admin</strong> (hoặc admin@quanlyts.com)
            </span>
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Mật khẩu:
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'block' }}>
              Mật khẩu mặc định: <strong>Admin2026</strong>
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, #003366 0%, #0056A3 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(0, 51, 102, 0.3)'
            }}
          >
            <ShieldCheck size={18} />
            {isLoading ? 'ĐANG XÁC THỰC...' : 'ĐĂNG NHẬP QUẢN TRỊ'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLoginModal;
