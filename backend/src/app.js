import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { errorHandler } from './middlewares/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import procurementRoutes from './routes/procurementRoutes.js';
import masterPoRoutes from './routes/masterPoRoutes.js';
import unitRoutes from './routes/unitRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import receiptRoutes from './routes/receiptRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

// Các routes hỗ trợ khác
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import lifecycleRoutes from './routes/lifecycleRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import approvalRoutes from './routes/approvalRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import supplierInvitationRoutes from './routes/supplierInvitationRoutes.js';

const app = express();

// Middlewares an toàn và hỗ trợ CORS
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    // Cho phép tất cả các domain nội bộ, localhost và tên miền quanlyts.com
    if (!origin || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') || 
        origin.includes('quanlyts.com')) {
      return callback(null, true);
    }
    return callback(null, true); // hoặc cho phép toàn bộ trong môi trường hiện tại
  },
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Tài liệu API Swagger / OpenAPI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    system: 'TRINHMUASAMONLINE Master PO Management API - Nam A Bank 2.0',
    timestamp: new Date().toISOString()
  });
});

// Các tuyến API Master PO & Lifecycle chuẩn Section K
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes);         // GET /api/users, GET /api/departments, GET /api/suppliers
app.use('/api', procurementRoutes);  // /api/procurement-batches, /api/procurement-requests
app.use('/api', masterPoRoutes);     // /api/purchase-orders/generate, /api/master-pos, /api/purchase-orders/:id
app.use('/api', unitRoutes);         // /api/units, /api/units/:id/purchase-items, /api/units/:id/purchase-timeline
app.use('/api', supplierRoutes);     // /api/supplier/purchase-orders, /api/supplier/deliveries
app.use('/api', receiptRoutes);      // /api/receipts, /api/receipts/:id
app.use('/api', reportRoutes);       // /api/reports/master-po, unit-procurement, supplier-performance

// Các tuyến hỗ trợ và tương thích ngược
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/lifecycles', lifecycleRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', supplierInvitationRoutes);

// Error handling tập trung
app.use(errorHandler);

export default app;
