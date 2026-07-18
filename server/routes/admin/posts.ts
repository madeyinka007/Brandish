import { Router } from 'express';
import * as postsController from '../../controllers/posts';
import { requireAuth, requireRole } from '../../middleware/auth';

// Wiring only. Post management is editor+ (see docs/api-routes.md).
const router = Router();
router.use(requireAuth, requireRole('editor', 'super-admin'));

router.get('/', postsController.adminList);
router.post('/', postsController.createPost);
router.put('/:id', postsController.updatePost);
router.delete('/:id', postsController.deletePost);

export default router;
