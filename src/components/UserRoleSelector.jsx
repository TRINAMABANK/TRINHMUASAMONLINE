import React, { useState, useRef, useEffect } from 'react';
import { DEMO_ACCOUNTS } from '../hooks/useAuth.js';
import { UserCheck, ChevronDown, ShieldCheck, Building2, Store, Eye, Check } from 'lucide-react';

export function UserRoleSelector({ currentUser, onSwitchRole, isLoading }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return { label: 'Quản trị viên (ADMIN)', bg: '#fef2f2', color: '#991b1b', border: '#fecaca', icon: ShieldCheck };
      case 'QTTS':
        return { label: 'Cán bộ QTTS', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe', icon: ShieldCheck };
      case 'HCQT':
        return { label: 'Cán bộ HCQT', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0', icon: ShieldCheck };
      case 'APPROVER':
        return { label: 'Lãnh đạo Phê duyệt', bg: '#faf5ff', color: '#6b21a8', border: '#e9d5ff', icon: UserCheck };
      case 'DON_VI':
      case 'UNIT_USER':
        return { label: 'Cán bộ Đơn vị (CN/PGD)', bg: '#fffbeb', color: '#92400e', border: '#fde68a', icon: Building2 };
      case 'SUPPLIER':
        return { label: 'Đối tác / NCC', bg: '#fff7ed', color: '#9a3412', border: '#fed7aa', icon: Store };
      default:
        return { label: 'Người xem (VIEWER)', bg: '#f8fafc', color: '#475569', border: '#cbd5e1', icon: Eye };
    }
  };

  const currentBadge = getRoleBadge(currentUser?.role || 'QTTS');
  const RoleIcon = currentBadge.icon;

  return (
    <div className="user-role-selector-container" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="role-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: '#ffffff',
          border: '1px solid #dce4ee',
          borderRadius: '6px',
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          fontSize: '13px',
          transition: 'all 0.15s ease'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: currentBadge.bg,
            color: currentBadge.color
          }}
        >
          <RoleIcon size={14} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', lineHeight: 1.2 }}>
          <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px' }}>
            {currentUser?.full_name || 'Cán bộ Nam A Bank'}
          </span>
          <span style={{ fontSize: '11px', color: currentBadge.color, fontWeight: 500 }}>
            {currentBadge.label} {currentUser?.department_name ? `• ${currentUser.department_name}` : currentUser?.supplier_name ? `• ${currentUser.supplier_name}` : ''}
          </span>
        </div>

        <ChevronDown size={14} style={{ color: '#64748b', marginLeft: '4px' }} />
      </button>

      {isOpen && (
        <div
          className="role-selector-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '320px',
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
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Chuyển đổi vai trò đăng nhập
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Phân quyền RBAC</span>
          </div>

          <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '6px' }}>
            {DEMO_ACCOUNTS.map((acc) => {
              const isSelected = currentUser?.role === acc.role;
              const badge = getRoleBadge(acc.role);
              const ItemIcon = badge.icon;

              return (
                <div
                  key={acc.role}
                  onClick={() => {
                    onSwitchRole(acc.role);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: isSelected ? '#f0f7ff' : 'transparent',
                    border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                    marginBottom: '4px',
                    transition: 'background 0.1s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: badge.bg,
                      color: badge.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <ItemIcon size={15} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                        {badge.label}
                      </span>
                      {isSelected && <Check size={14} color="#0056A3" />}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {acc.email} • {acc.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              padding: '8px 12px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              fontSize: '11px',
              color: '#64748b',
              textAlign: 'center'
            }}
          >
            Chuyển đổi góc nhìn phân quyền (RBAC) • <span style={{ fontWeight: 600, color: '#0056A3' }}>Không yêu cầu mật khẩu</span>
          </div>
        </div>
      )}
    </div>
  );
}
