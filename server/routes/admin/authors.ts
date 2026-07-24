import { Router } from 'express';
import * as usersController from '../../controllers/users';
import { requireAuth, requireRole } from '../../middleware/auth';

// The post-author pool. editor+ (unlike the full users list, which is super-admin only) so
// editors can pick who a post is authored by. Returns only { _id, name, avatar, role }.
const router = Router();
router.use(requireAuth, requireRole('editor', 'super-admin'));

router.get('/', usersController.listAuthors);

export default router;
