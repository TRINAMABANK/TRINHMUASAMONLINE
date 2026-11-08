import React, { useState, useEffect, useRef, useCallback } from 'react';
import { masterDataApi } from '../services/api/lifecycleApi.js';
import { Bell, AlertTriangle, CheckCircle2, Clock, Info, X } from 'lucide-react';

export function NotificationBell({ currentUser, onNavigateToPO }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await masterDataApi.getNotifications();
      if (res.success && Array.isArray(res.data)) {
        setNotifications(res.data);
        setUnreadCount(res.data.filter(n => !n.is_read).length);
      }
    } catch (e) {
      // Bỏ qua lỗi kết nối ngầm
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Tự động làm mới mỗi 15s
    return () => clearInterval(interval);
  }, [fetchNotifications, currentUser]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id, link) => {
    try {
      await masterDataApi.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      if (link && onNavigateToPO) {
        setIsOpen(false);
        const poId = link.replace('/pos/', '');
        onNavigateToPO(poId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getIcon = (title = '') => {
    if (title.includes('bất thường') || title.includes('Cảnh báo') || title.includes('trễ')) {
      return <AlertTriangle size={15} color="#dc2626" />;
    }
    if (title.includes('hoàn tất') || title.includes('thành công')) {
      return <CheckCircle2 size={15} color="#16a34a" />;
    }
    return <Clock size={15} color="#0056A3" />;
  };

  return (
    <div className="notification-bell-container" ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: '1px solid #dce4ee',
          background: '#ffffff',
          cursor: 'pointer',
          color: '#475569',
          transition: 'all 0.15s ease'
        }}
        title="Thông báo hệ thống"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              background: '#dc2626',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: '10px',
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #ffffff'
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '340px',
            background: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
            zIndex: 1000,
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Thông báo nghiệp vụ
              </span>
              {unreadCount > 0 && (
                <span style={{ fontSize: '11px', background: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: '10px', fontWeight: 600 }}>
                  {unreadCount} mới
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                Không có thông báo mới nào
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleMarkAsRead(n.id, n.link)}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid #f1f5f9',
                    background: n.is_read ? '#ffffff' : '#f0f9ff',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '10px',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = n.is_read ? '#ffffff' : '#f0f9ff'; }}
                >
                  <div style={{ marginTop: '2px', flexShrink: 0 }}>
                    {getIcon(n.title)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '12px', fontWeight: n.is_read ? 600 : 700, color: '#1e293b' }}>
                        {n.title}
                      </span>
                      {!n.is_read && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0284c7', marginTop: '4px' }} />
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px', lineHeight: 1.3 }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                      {n.created_at ? new Date(n.created_at).toLocaleString('vi-VN') : 'Vừa xong'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
