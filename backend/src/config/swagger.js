import swaggerJSDoc from 'swagger-jsdoc';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TRINHMUASAMONLINE API - Nam A Bank QTTS 2.0',
      version: '2.0.0',
      description: 'Hệ thống Quản trị Tài sản & Theo dõi Vòng đời Mua sắm (Procurement Lifecycle Tracking)',
      contact: {
        name: 'Ban Quản trị Tài sản Nam A Bank'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Máy chủ Localhost'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js']
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);
