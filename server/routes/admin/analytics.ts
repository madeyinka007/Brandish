import { Router } from 'express';
import * as analyticsController from '../../controllers/analytics';
import { requireAuth, requireRole } from '../../middleware/auth';

// Wiring only. Analytics is editor+ (reporting surface — see docs/auth.md, docs/api-routes.md).
const router = Router();
router.use(requireAuth, requireRole('editor', 'super-admin'));

router.get('/', analyticsController.getAnalytics);

export default router;
