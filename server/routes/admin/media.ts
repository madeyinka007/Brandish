import { Router } from 'express';
import * as mediaController from '../../controllers/media';
import { requireAuth, requireRole } from '../../middleware/auth';

// Owns the `media` collection (native driver). editor+.
const router = Router();
router.use(requireAuth, requireRole('editor', 'super-admin'));

router.get('/', mediaController.listMedia);
router.post('/', mediaController.createMedia);
router.delete('/:id', mediaController.deleteMedia);

export default router;
