import { Router } from 'express';
import * as commentsController from '../../controllers/comments';
import { requireAuth, requireRole } from '../../middleware/auth';

// Wiring only. Comment moderation is editor+ (see docs/auth.md, docs/api-routes.md).
const router = Router();
router.use(requireAuth, requireRole('editor', 'super-admin'));

router.get('/', commentsController.listComments);
router.put('/:id', commentsController.moderateComment);
router.delete('/:id', commentsController.deleteComment);

export default router;
