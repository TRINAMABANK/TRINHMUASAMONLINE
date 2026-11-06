import React, { useState, useEffect } from 'react';
import { formatNumber } from '../utils/currencyUtils.js';

export function EditableCell({
  value,
  type = 'text',
  align = 'left',
  onChange,
  className = '',
  placeholder = ''
}) {
  const [currentVal, setCurrentVal] = useState(value ?? '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setCurrentVal(value ?? '');
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    if (currentVal !== value) {
      onChange(currentVal);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setCurrentVal(value ?? '');
      setIsEditing(false);
    }
  };

  // Nếu là dạng số và không đang edit thì hiển thị format #,##0 đẹp mắt
  const displayValue = !isEditing && type === 'number' && currentVal !== ''
    ? formatNumber(currentVal)
    : currentVal;

  return (
    <div className={`editable-cell-wrapper align-${align} ${className}`}>
      <input
        type={isEditing && type === 'number' ? 'number' : 'text'}
        className={`editable-cell-input ${isEditing ? 'is-editing' : ''}`}
        value={isEditing ? currentVal : displayValue}
        placeholder={placeholder}
        onFocus={() => setIsEditing(true)}
        onChange={(e) => setCurrentVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
