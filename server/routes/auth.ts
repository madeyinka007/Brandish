import { Router } from 'express';
import * as authController from '../controllers/auth';
import { requireAuth } from '../middleware/auth';

// Wiring only — path + method + middleware + controller. No logic here (see docs/development.md).
const router = Router();

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/change-password', requireAuth, authController.changePassword);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

export default router;
