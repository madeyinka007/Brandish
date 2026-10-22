import { Router } from 'express';
import * as newsletterController from '../controllers/newsletter';
import { scopedRateLimit } from '../middleware/rateLimit';

// Public newsletter endpoints. Sign-up writes a `pending` subscriber and emails a
// double opt-in link (see docs/workflows.md). The limiter has its own bucket — the shared
// three-per-hour allowance belongs to comments, and a reader must be able to do both.
const router = Router();

router.post('/', scopedRateLimit('newsletter', 20), newsletterController.subscribe);
router.get('/confirm', newsletterController.confirm);
router.get('/unsubscribe', newsletterController.unsubscribe);

export default router;
