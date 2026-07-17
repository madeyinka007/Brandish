import { Router } from 'express';
import * as categoriesController from '../../controllers/categories';
import { requireAuth, requireRole } from '../../middleware/auth';

// Wiring only. All category management is editor+ (managing categories is an editor
// permission — see docs/auth.md).
const router = Router();
router.use(requireAuth, requireRole('editor', 'super-admin'));

router.get('/', categoriesController.listAll);
router.post('/', categoriesController.createCategory);
// `/reorder` must be registered before `/:id`, or Express matches it as id='reorder'.
router.put('/reorder', categoriesController.reorder);
router.put('/:id', categoriesController.updateCategory);
router.delete('/:id', categoriesController.deleteCategory);

export default router;
