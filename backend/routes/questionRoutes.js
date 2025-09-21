import express from 'express';
import * as Q from '../controller/questionController.js';
// import { verifyToken, requireRole } from '../middlewares/verifyToken.js';

const router = express.Router();

// Questions
router.post('/', /*verifyToken, requireRole('admin'),*/ Q.create);
router.get('/:id', /*verifyToken,*/ Q.get);
router.put('/:id', /*verifyToken, requireRole('admin'),*/ Q.update);
router.delete('/:id', /*verifyToken, requireRole('admin'),*/ Q.remove);

// Options
router.post('/:id/options', /*verifyToken, requireRole('admin'),*/ Q.addQuestionOption);
router.delete('/options/:optionId', /*verifyToken, requireRole('admin'),*/ Q.deleteQuestionOption);

// Sub-questions
router.post('/:id/sub-questions', /*verifyToken, requireRole('admin'),*/ Q.addSubQ);
router.delete('/sub-questions/:subId', /*verifyToken, requireRole('admin'),*/ Q.deleteSubQ);

// Single-call full update of a question:
router.put('/:id/full', /* verifyToken, requireRole('admin'), */ Q.updateFull);

export default router;
