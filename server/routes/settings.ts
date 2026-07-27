import { Router } from 'express';
import * as settingsController from '../controllers/settings';

// Public, unauthenticated — the blog reads site identity, theme and reading prefs. Only the
// non-secret subset is exposed (see settingsService.toPublic).
const router = Router();

router.get('/', settingsController.getPublic);

export default router;
