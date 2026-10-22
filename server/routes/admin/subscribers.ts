import { Router } from 'express';
import * as subscribersController from '../../controllers/subscribers';
import { requireAuth, requireRole } from '../../middleware/auth';

// Wiring only. Subscriber management is editor+ (same as tags/categories — see docs/auth.md).
const router = Router();
router.use(requireAuth, requireRole('editor', 'super-admin'));

router.get('/', subscribersController.listSubscribers);
router.get('/export', subscribersController.exportSubscribers);
router.post('/:id/resend', subscribersController.resendConfirmation);
router.delete('/:id', subscribersController.deleteSubscriber);

export default router;
