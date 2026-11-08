import React, { useState } from 'react';
import { authApi } from '../services/api/authApi.js';
import { ShieldCheck, Lock, User, AlertCircle, X, LogIn } from 'lucide-react';

export function AdminLoginModal({ isOpen, onClose, onSuccess, canClose = true }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await authApi.login(username.trim(), password.trim());
      if (res.success && res.data?.user) {
        if (onSuccess) {
          onSuccess(res.data.user);
        }
        if (canClose && onClose) onClose();
      } else {
        setErrorMessage(res.message || 'Tài khoản hoặc mật khẩu không chính xác.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Lỗi kết nối máy chủ xác thực.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOverlayClick = () => {
    if (canClose && onClose) {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      style={{
        zIndex: 2000,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(4px)',
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '440px',
          width: '100%',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          background: '#ffffff',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Header khớp chuẩn thiết kế Nam A Bank */}
        <div style={{
          background: 'linear-gradient(135deg, #003366 0%, #001f3f 100%)',
          color: '#ffffff',
          padding: '28px 24px 22px',
          position: 'relative',
          textAlign: 'center'
        }}>
          {canClose && onClose && (
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
              title="Đóng"
            >
              <X size={18} />
            </button>
          )}

          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: '#FFD200',
            color: '#003366',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 4px 16px rgba(255, 210, 0, 0.4)'
          }}>
            <ShieldCheck size={34} />
          </div>

          <h2 style={{ margin: '0 0 6px', fontSize: '19px', fontWeight: 800, letterSpacing: '0.5px' }}>
            CỔNG ĐĂNG NHẬP HỆ THỐNG
          </h2>
          <p style={{ margin: 0, fontSize: '13px', opacity: 0.88, color: '#e2e8f0' }}>
            Nam A Bank • Quản Trị Mua Sắm & Vòng Đời PO
          </p>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', background: '#ffffff' }}>
          {errorMessage && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '18px',
              color: '#991b1b',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '7px' }}>
              Tài khoản đăng nhập:
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập hoặc email..."
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '11px 12px 11px 40px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  color: '#0f172a'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '7px' }}>
              Mật khẩu:
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                required
                style={{
                  width: '100%',
                  padding: '11px 12px 11px 40px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  color: '#0f172a'
                }}
              />
            </div>
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
              borderRadius: '7px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: '0 4px 14px rgba(0, 51, 102, 0.35)'
            }}
          >
            <LogIn size={18} />
            {isLoading ? 'ĐANG XÁC THỰC...' : 'ĐĂNG NHẬP HỆ THỐNG'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLoginModal;
