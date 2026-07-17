import { Router } from 'express';
import * as usersController from '../../controllers/users';
import { requireAuth, requireRole } from '../../middleware/auth';

// Wiring only. Every user-management route is super-admin-only, applied once here.
const router = Router();
router.use(requireAuth, requireRole('super-admin'));

router.get('/', usersController.listUsers);
router.post('/', usersController.createUser);
router.put('/:id', usersController.updateUser);
router.put('/:id/role', usersController.assignRole);
router.put('/:id/status', usersController.setStatus);
router.delete('/:id', usersController.deleteUser);

export default router;
