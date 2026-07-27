import { Router } from 'express';
import * as settingsController from '../../controllers/settings';
import { requireAuth, requireRole } from '../../middleware/auth';

// Wiring only. Reading is editor+ (shared behaviour like moderation thresholds must be visible);
// writing is super-admin (site-wide config). See docs/api-routes.md.
const router = Router();
router.use(requireAuth);

router.get('/', requireRole('editor', 'super-admin'), settingsController.getAdmin);
router.put('/', requireRole('super-admin'), settingsController.update);

export default router;
