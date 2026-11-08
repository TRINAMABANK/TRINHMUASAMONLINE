import express from 'express';
import { login, refreshToken, logout, getMe, getUsers, getDepartments, getSuppliers } from '../controllers/authController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);

router.get('/users', authenticate, authorizeRoles('ADMIN', 'QTTS'), getUsers);
router.get('/departments', authenticate, getDepartments);
router.get('/suppliers', authenticate, getSuppliers);

export default router;
