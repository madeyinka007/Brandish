import { Router } from 'express';
import * as commentsController from '../controllers/comments';
import { rateLimit } from '../middleware/rateLimit';
import { validateRecaptcha } from '../middleware/recaptcha';

// Public comments. Reads are open; submissions pass reCAPTCHA + per-IP rate limiting before
// the controller strips HTML and stores the comment as `pending` (see docs/workflows.md).
const router = Router();

router.get('/', commentsController.listPublic);
router.post('/', validateRecaptcha, rateLimit, commentsController.createComment);

export default router;
