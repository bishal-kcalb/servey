// controllers/responseController.js
import db from '../db_connection/connection.js';
import {
  createSubmission,
  insertAnswers,
  listMySubmissions,
  listMySubmissionsBySurvey,
  getSubmissionDetails,
    getMySurveySummaries,
  getMySubmissionsForSurvey,

} from '../models/responseModel.js';

export const ResponseController = {
  // POST /survey/:id/answers
  submitAnswers: async (req, res) => {
    const survey_id = Number(req.params.id);
    const { answers, responser } = req.body || {};
    const user_id = req.user?.id ?? null; // from JWT

    if (!survey_id) return res.status(400).json({ error: 'Invalid survey id' });
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'answers array is required' });
    }

    try {
      const result = await db.tx(async (t) => {
        const submission = await createSubmission(t, { user_id, survey_id, responser });
        const ins = await insertAnswers(t, submission.id, answers);
        return { submission_id: submission.id, submitted_at: submission.created_at, inserted: ins.inserted };
      });
      return res.json({ message: 'ok', ...result });
    } catch (e) {
      console.error(e);
      return res.status(400).json({ error: e.message || 'Failed to submit responses' });
    }
  },

  // GET /responses/me
  listMine: async (req, res) => {
    try {
      const rows = await listMySubmissions(req.user.id);
      return res.json({ items: rows });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  },


  // GET /responses/survey/:surveyId (mine)
  listMineBySurvey: async (req, res) => {
    const survey_id = Number(req.params.surveyId);
    if (!survey_id) return res.status(400).json({ error: 'Invalid survey id' });
    try {
      const rows = await listMySubmissionsBySurvey(req.user.id, survey_id);
      return res.json({ items: rows });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  },

  // GET /responses/:submissionId
  detail: async (req, res) => {
    try {
      const out = await getSubmissionDetails(req.params.submissionId);
      if (!out) return res.status(404).json({ error: 'Submission not found' });
      // Optionally enforce ownership: if (out.meta.user_id !== req.user.id) return res.status(403).json({error:'Forbidden'})
      return res.json(out);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Failed to fetch details' });
    }
  },

    // GET /responses/me
  mySummaries: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const items = await getMySurveySummaries(userId);
      return res.json({ items });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Failed to load my responses' });
    }
  },

  // GET /responses/survey/:id/mine
  mySubmissionsForSurvey: async (req, res) => {
    try {
      const userId = req.user?.id;
      const surveyId = Number(req.params.id);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!surveyId) return res.status(400).json({ error: 'Invalid survey id' });

      const rows = await getMySubmissionsForSurvey(userId, surveyId);
      return res.json({ submissions: rows });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Failed to load submissions' });
    }
  },

  // GET /responses/submission/:submissionId
  submissionDetails: async (req, res) => {
    try {
      const submissionId = req.params.submissionId;
      if (!submissionId) return res.status(400).json({ error: 'Invalid submission id' });

      const rows = await getSubmissionDetails(submissionId);
      return res.json({ submission_id: submissionId, rows });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Failed to load submission details' });
    }
  },

};
