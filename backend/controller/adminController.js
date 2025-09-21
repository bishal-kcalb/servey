// server/controllers/adminController.js
import {
  getTotalSurveyors,
  getTotalSurveys,
  getActiveSurveys,
  getTotalResponses,
  getCompletionRate,
  getTopParticipation,
  getAnswerDistribution,
  getRecentSurveys,
} from '../models/adminModel.js';

export const getMetrics = async (req, res) => {
  try {
    const [
      totalSurveyors,
      totalSurveys,
      activeSurveys,
      totalResponses,
      completionRate,
      topParticipation,
      recentSurveys,
    ] = await Promise.all([
      getTotalSurveyors(),
      getTotalSurveys(),
      getActiveSurveys(30),
      getTotalResponses(),
      getCompletionRate(),
      getTopParticipation(3),
      getRecentSurveys(3),
    ]);

    // Build chart payloads for your RN dashboard
    const barData = {
      labels: topParticipation.map(r => r.title.length > 12 ? r.title.slice(0, 12) + '…' : r.title),
      datasets: [{ data: topParticipation.map(r => r.submissions) }],
    };

    res.json({
      totalSurveyors,
      totalSurveys,
      activeSurveys,
      totalResponses,
      completionRate, // %
      barData,
      recentSurveys,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load metrics' });
  }
};

export const getAnswerSplit = async (req, res) => {
  try {
    const { surveyId } = req.query;
    if (!surveyId) return res.status(400).json({ error: 'surveyId is required' });
    const { yes, no, neutral } = await getAnswerDistribution(Number(surveyId));
    res.json({ yes, no, neutral });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load answer distribution' });
  }
};

import { 
  getAllCompletedSurveys, 
   getResponsesBySurveyAllUsers,
  // ... other imports
} from '../models/adminModel.js';

export const getAllCompletedSurveysList = async (req, res) => {
  try {
    const rows = await getAllCompletedSurveys();
    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load completed surveys' });
  }
};


export const getAdminResponsesBySurvey = async (req, res) => {
  try {
    const { surveyId } = req.query;
    if (!surveyId) {
      return res.status(400).json({ error: 'surveyId is required' });
    }

    const items = await getResponsesBySurveyAllUsers(surveyId);
    return res.json({ items });
  } catch (err) {
    console.error('getAdminResponsesBySurvey error:', err);
    return res.status(500).json({ error: 'Failed to load responses for survey' });
  }
};

