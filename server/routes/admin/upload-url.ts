import { Router } from 'express';
import * as uploadUrlController from '../../controllers/uploadUrl';
import { requireAuth, requireRole } from '../../middleware/auth';

// Talks to S3 only (presigned URL) — no media record exists yet. editor+.
const router = Router();
router.use(requireAuth, requireRole('editor', 'super-admin'));

router.get('/', uploadUrlController.getUploadUrl); // GET /api/admin/upload-url?filename=&type=

export default router;
