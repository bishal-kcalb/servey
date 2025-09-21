// routes/headingRoutes.js
import express from 'express';
import { update } from '../controller/headingController.js';
// import { verifyToken } from '../middlewares/verifyToken.js';
// import { requireRole } from '../middlewares/requireRole.js';

const router = express.Router();

// PUT /headings/:id  -> { title }
router.put('/:id',
  // verifyToken,
  // requireRole('admin'),
  update
);

export default router;
