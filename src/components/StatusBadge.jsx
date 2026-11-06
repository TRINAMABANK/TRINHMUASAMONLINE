import React from 'react';
import { STAGE_CONFIG } from '../utils/constants.js';

export function StatusBadge({ status, className = '' }) {
  const config = STAGE_CONFIG[status] || { badgeClass: 'badge-default' };

  return (
    <span className={`status-badge ${config.badgeClass} ${className}`}>
      <span className="status-dot"></span>
      {status || 'Không rõ'}
    </span>
  );
}
