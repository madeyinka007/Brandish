import { Router } from 'express';
import * as tagsController from '../../controllers/tags';
import { requireAuth, requireRole } from '../../middleware/auth';

// Wiring only. Tag management is editor+ (same as categories — see docs/auth.md).
const router = Router();
router.use(requireAuth, requireRole('editor', 'super-admin'));

router.get('/', tagsController.listTagsWithUsage);
router.post('/', tagsController.createTag);
router.put('/:id', tagsController.updateTag);
router.delete('/:id', tagsController.deleteTag);

export default router;
