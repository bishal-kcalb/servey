// routes/responseRoutes.js
import express from 'express';
import { ResponseController } from '../controller/responseController.js';
import * as AuthMiddleware from '../middlewares/auth.js'; // your verifyToken middleware

const router = express.Router();

router.post(
  '/survey/:id/answers',
  AuthMiddleware.verifyToken,
  ResponseController.submitAnswers
);

router.get(
  '/responses/me',
  AuthMiddleware.verifyToken,
  ResponseController.mySummaries
);

router.get(
  '/responses/survey/:surveyId',
  AuthMiddleware.verifyToken,
  ResponseController.listMineBySurvey
);

router.get(
  '/responses/:submissionId',
  AuthMiddleware.verifyToken,
  ResponseController.detail
);

router.get('/responses/survey/:id/mine', AuthMiddleware.verifyToken, ResponseController.mySubmissionsForSurvey);
router.get('/responses/submission/:submissionId', AuthMiddleware.verifyToken, ResponseController.submissionDetails)


// router.get('/me', AuthMiddleware.verifyToken, ResponseController.listMyCompleted);


export default router;
