import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Lỗi ứng dụng:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#d32f2f' }}>Hệ Thống Quản Trị Mua Sắm & Trình Ký QTTS</h2>
          <p style={{ color: '#555', marginTop: '12px' }}>Đang nạp lại tài nguyên phiên bản mới nhất...</p>
          {this.state.error && (
            <div style={{ margin: '16px auto', maxWidth: '700px', background: '#fff', border: '1px solid #ffcdd2', padding: '14px', borderRadius: '8px', textAlign: 'left', color: '#b71c1c' }}>
              <strong>Chi tiết lỗi:</strong>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px', marginTop: '6px', color: '#b71c1c' }}>
                {this.state.error.message || String(this.state.error)}
              </pre>
            </div>
          )}
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ padding: '10px 24px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '16px', fontWeight: 'bold' }}
          >
            Tải Lại Trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
