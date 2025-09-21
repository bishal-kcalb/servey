import express from 'express';
import * as Survey from '../controller/surveyController.js';
// import { verifyToken, requireRole } from '../middlewares/verifyToken.js';

const router = express.Router();

/* ---- STATIC / SPECIAL ROUTES FIRST ---- */
router.get('/', /*verifyToken,*/ Survey.list);
router.get('/surveyors', /*verifyToken,*/ Survey.getSurveyors);
router.get('/assigned', /* verifyToken, */ Survey.listAssignedSurveys);
router.post('/full', /*verifyToken, requireRole('admin'),*/ Survey.createFull);
router.put('/:id/full', /*verifyToken, requireRole('admin'),*/ Survey.updateFull);
router.get('/:id/full', /*verifyToken,*/ Survey.getFull);

/* Assignment routes (don’t conflict with /:id because they’re 2 segments) */
router.post('/:surveyId/assign', /*verifyToken, requireRole('admin'),*/ Survey.postAssignSurvey);
router.get('/:surveyId/assignees', /*verifyToken,*/ Survey.getSurveyAssignees);
router.delete('/:surveyId/assignees/:surveyorId', /*verifyToken, requireRole('admin'),*/ Survey.deleteAssignment);

/* ---- CORE CRUD AFTERWARDS ---- */
router.post('/', /*verifyToken, requireRole('admin'),*/ Survey.create);
router.get('/', /*verifyToken,*/ Survey.list);
router.post('/:id/headings', /*verifyToken, requireRole('admin'),*/ Survey.addHeadingToSurvey);

/* keep generic /:id LAST of the GET/PUT/DELETE so it doesn't “steal” others */
router.get('/:id', /*verifyToken,*/ Survey.get);
router.put('/:id', /*verifyToken, requireRole('admin'),*/ Survey.update);
router.delete('/:id', /*verifyToken, requireRole('admin'),*/ Survey.remove);

export default router;
