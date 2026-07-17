import { Router } from 'express';
import * as tagsController from '../controllers/tags';

// Public — list all tags for tag-cloud / filter UI.
const router = Router();

router.get('/', tagsController.listTags);

export default router;
