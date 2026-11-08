import app from './app.js';
import { initDatabase, queryOne } from './config/database.js';
import { runSeed as seedDatabase } from '../prisma/seed.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('================================================================');
    console.log('  KHỞI ĐỘNG HỆ THỐNG BACKEND TRINHMUASAMONLINE - NAM A BANK QTTS');
    console.log('================================================================');

    // 1. Khởi tạo cơ sở dữ liệu PostgreSQL
    await initDatabase();

    // 2. Tự động kiểm tra và nạp dữ liệu seed ban đầu nếu chưa có tài khoản admin
    const userCount = await queryOne('SELECT count(*) as cnt FROM users');
    if (!userCount || Number(userCount.cnt) === 0) {
      console.log('[Seed] Phát hiện cơ sở dữ liệu mới. Đang nạp dữ liệu mẫu ban đầu...');
      await seedDatabase();
    }

    // 3. Khởi động HTTP Server
    app.listen(PORT, () => {
      console.log(`[HTTP Server] Máy chủ Backend đang lắng nghe tại: http://localhost:${PORT}`);
      console.log(`[Swagger Docs] Tài liệu API tương tác Swagger tại: http://localhost:${PORT}/api/docs`);
      console.log(`[Health Check] Kiểm tra trạng thái máy chủ tại: http://localhost:${PORT}/api/health`);
      console.log('================================================================');
    });
  } catch (err) {
    console.error('[Startup Error] Lỗi khởi động máy chủ:', err);
    process.exit(1);
  }
}

startServer();
