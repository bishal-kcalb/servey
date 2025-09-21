import {
  createSurvey, getSurveys, getSurveyById,
  updateSurvey, deleteSurvey, addHeading,
  getSurveyFullTree, updateSurveyFull, createSurveyFull,  listSurveyors,
  assignSurveyToSurveyor,
  listSurveyAssignees,
  unassignSurveyor
} from '../models/surveyModel.js';
import db from '../db_connection/connection.js';

export const create = async (req, res) => {
  try {
    const survey = await createSurvey(req.body); // {title, description}
    res.status(201).json(survey);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create survey' });
  }
};

export const list = async (_req, res) => {
  try {
    const rows = await getSurveys();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch surveys' });
  }
};

export const get = async (req, res) => {
  try {
    const survey = await getSurveyById(req.params.id);
    if (!survey) return res.status(404).json({ error: 'Survey not found' });
    res.json(survey);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch survey' });
  }
};

export const getFull = async (req, res) => {
  try {
    const tree = await getSurveyFullTree(req.params.id);
    if (!tree) return res.status(404).json({ error: 'Survey not found' });
    res.json(tree);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch survey tree' });
  }
};

export const update = async (req, res) => {
  try {
    const survey = await updateSurvey(req.params.id, req.body);
    res.json(survey);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update survey' });
  }
};

export const remove = async (req, res) => {
  try {
    const count = await deleteSurvey(req.params.id);
    if (!count) return res.status(404).json({ error: 'Survey not found' });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete survey' });
  }
};

export const addHeadingToSurvey = async (req, res) => {
  try {
    const row = await addHeading({ survey_id: req.params.id, title: req.body.title });
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add heading' });
  }
};




export const createFull = async (req, res) => {
  try {
    // Basic guards; add more validation as needed
    if (!req.body?.title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const out = await createSurveyFull(req.body);
    return res.status(201).json(out);
  } catch (e) {
    console.error('createFull error:', e);
    return res.status(500).json({ error: 'Failed to create full survey' });
  }
};


export const updateFull = async (req, res) => {
  try {
    if (!req.body?.title) {
      return res.status(400).json({ error: 'title is required' });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'invalid survey id' });
    }

    const out = await updateSurveyFull(id, req.body);
    return res.status(200).json(out);
  } catch (e) {
    console.error('updateFull error:', e);
    if (e.status === 404) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    return res.status(500).json({ error: 'Failed to update full survey' });
  }
};



export const getSurveyors = async (_req, res) => {
  try {
    const rows = await listSurveyors();
    return res.json({ surveyors: rows });
  } catch (e) {
    console.error('getSurveyors error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};

export const postAssignSurvey = async (req, res) => {
  try {
    const survey_id = Number(req.params.surveyId);
    const { surveyor_id } = req.body || {};
    if (!Number.isInteger(survey_id) || !Number.isInteger(Number(surveyor_id))) {
      return res.status(400).json({ error: 'surveyId and surveyor_id must be integers' });
    }

    // If you have auth middleware, you can capture admin id:
    const assigned_by = req.user?.id ?? null;

    const row = await assignSurveyToSurveyor({
      survey_id,
      surveyor_id: Number(surveyor_id),
      assigned_by
    });

    return res.json({ message: 'Assigned', assignment: row });
  } catch (e) {
    console.error('postAssignSurvey error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};

export const getSurveyAssignees = async (req, res) => {
  try {
    const survey_id = Number(req.params.surveyId);
    if (!Number.isInteger(survey_id)) return res.status(400).json({ error: 'Invalid surveyId' });
    const rows = await listSurveyAssignees(survey_id);
    return res.json({ assignees: rows });
  } catch (e) {
    console.error('getSurveyAssignees error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Optional
export const deleteAssignment = async (req, res) => {
  try {
    const survey_id = Number(req.params.surveyId);
    const surveyor_id = Number(req.params.surveyorId);
    if (!Number.isInteger(survey_id) || !Number.isInteger(surveyor_id))
      return res.status(400).json({ error: 'Invalid ids' });

    const removed = await unassignSurveyor({ survey_id, surveyor_id });
    if (!removed) return res.status(404).json({ error: 'Assignment not found' });
    return res.status(204).send();
  } catch (e) {
    console.error('deleteAssignment error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};





export async function listAssignedSurveys(req, res) {
  try {
    // If you use JWT: const surveyorId = req.user.id;
    const raw = req.query.surveyorId ?? req.user?.id;
    const surveyorId = Number(raw);

    if (!Number.isInteger(surveyorId)) {
      return res.status(400).json({ error: 'surveyorId is required and must be an integer' });
    }

    // Keep it minimal: no ORDER BY updated_at (it might not exist).
    const rows = await db.any(
      `
      SELECT s.id, s.title, s.description
      FROM survey_assignments sa
      JOIN surveys s ON s.id = sa.survey_id
      WHERE sa.surveyor_id = $1
      ORDER BY s.id DESC
      `,
      [surveyorId]
    );

    return res.json({ surveys: rows });
  } catch (e) {
    console.error('[listAssignedSurveys] DB error:', e); // shows code/detail/stack in server console
    return res.status(500).json({ error: 'Failed to fetch assigned surveys' });
  }
}
