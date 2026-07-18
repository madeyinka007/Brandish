import { Router } from 'express';
import * as postsController from '../controllers/posts';

// Public — published posts only. `/:slug` matches a single post; the list is at `/`.
const router = Router();

router.get('/', postsController.list);
router.get('/:slug', postsController.getBySlug);

export default router;
