// server/routes/admin.js
import express from 'express';
import { getMetrics, getAnswerSplit } from '../controller/adminController.js';
import { getAllCompletedSurveysList, getAdminResponsesBySurvey } from '../controller/adminController.js';


// optionally add auth middleware if required
// import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// router.use(requireAuth, requireAdmin);
router.get('/metrics', getMetrics);
router.get('/answer-distribution', getAnswerSplit);
router.get('/completed-surveys', getAllCompletedSurveysList);


router.get('/responses', getAdminResponsesBySurvey);


export default router;
