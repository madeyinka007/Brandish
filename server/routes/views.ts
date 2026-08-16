import { Router } from 'express';
import * as viewsController from '../controllers/views';

// Public view tracking — the write side of analytics. Open (no auth); a POST on post load
// appends a page_views event and increments the deduped viewCount. See docs/workflows.md.
const router = Router();

router.post('/:id', viewsController.recordView);

export default router;
