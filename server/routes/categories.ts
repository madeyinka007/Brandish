import { Router } from 'express';
import * as categoriesController from '../controllers/categories';

// Public — active categories only, for nav/filter UI.
const router = Router();

router.get('/', categoriesController.listPublic);

export default router;
