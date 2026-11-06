import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, X, CheckCircle2, AlertCircle } from 'lucide-react';

export function UploadExcel({
  fileName,
  isLoading,
  error,
  validCount,
  onFileSelect,
  onClear,
  onLoadSample
}) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        onFileSelect(file);
      } else {
        alert('Vui lòng chỉ tải lên file định dạng Excel (.xlsx hoặc .xls)');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="upload-container">
      <div
        className={`upload-dropzone ${isDragOver ? 'drag-over' : ''} ${fileName ? 'has-file' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !fileName && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {!fileName ? (
          <div className="upload-empty-state">
            <div className="upload-icon-circle">
              <UploadCloud size={32} className="upload-icon" />
            </div>
            <h3 className="upload-title">Tải lên file Excel phiếu thô (.xlsx, .xls)</h3>
            <p className="upload-subtitle">
              Kéo thả file vào đây hoặc <span className="upload-browse-btn">chọn từ máy tính</span>
            </p>
            <div className="upload-formats">
              Hệ thống tự động đọc và map 10 trường dữ liệu (STT, Ngày đề xuất, Đơn vị, NCC, Nội dung, SL, Quy cách, Đơn giá, Thành tiền, Mục đích)
            </div>
          </div>
        ) : (
          <div className="upload-file-state">
            <div className="file-info-group">
              <div className="file-icon-badge">
                <FileSpreadsheet size={28} />
              </div>
              <div className="file-details">
                <span className="file-name">{fileName}</span>
                <span className="file-status">
                  {isLoading ? (
                    'Đang phân tích dữ liệu...'
                  ) : error ? (
                    <span className="text-danger flex-align">
                      <AlertCircle size={14} style={{ marginRight: 4 }} />
                      Lỗi: {error}
                    </span>
                  ) : (
                    <span className="text-success flex-align">
                      <CheckCircle2 size={14} style={{ marginRight: 4 }} />
                      Đã đọc thành công {validCount} dòng dữ liệu hợp lệ
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="file-actions" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="btn-file-clear"
                onClick={() => {
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  onClear();
                }}
                title="Hủy file và chọn lại"
              >
                <X size={16} />
                Đổi file khác
              </button>
            </div>
          </div>
        )}
      </div>

      {onLoadSample && !fileName && (
        <div className="sample-quick-access">
          <span className="muted-text">Hoặc thử nhanh với:</span>
          <button
            type="button"
            className="btn-sample-link"
            onClick={onLoadSample}
          >
            Nạp file phiếu thô thử nghiệm (45 dòng mẫu)
          </button>
        </div>
      )}
    </div>
  );
}
