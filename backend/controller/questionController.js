import {
  createQuestion, getQuestionById, updateQuestion, deleteQuestion,
  addOption, deleteOption, addSubQuestion, deleteSubQuestion, updateQuestionFull
} from '../models/questionModel.js';

export const create = async (req, res) => {
  try {
    const q = await createQuestion(req.body);
    res.status(201).json(q);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create question' });
  }
};

export const get = async (req, res) => {
  try {
    const q = await getQuestionById(req.params.id);
    if (!q) return res.status(404).json({ error: 'Question not found' });
    res.json(q);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch question' });
  }
};

export const update = async (req, res) => {
  try {
    const q = await updateQuestion(req.params.id, req.body);
    res.json(q);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update question' });
  }
};

export const remove = async (req, res) => {
  try {
    const count = await deleteQuestion(req.params.id);
    if (!count) return res.status(404).json({ error: 'Question not found' });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete question' });
  }
};

/** Options */
export const addQuestionOption = async (req, res) => {
  try {
    const row = await addOption(req.params.id, req.body); // {option_text, is_other}
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add option' });
  }
};

export const deleteQuestionOption = async (req, res) => {
  try {
    const count = await deleteOption(req.params.optionId);
    if (!count) return res.status(404).json({ error: 'Option not found' });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete option' });
  }
};

/** Sub-questions */
export const addSubQ = async (req, res) => {
  try {
    const row = await addSubQuestion(req.params.id, req.body); // {label, type}
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add sub-question' });
  }
};

export const deleteSubQ = async (req, res) => {
  try {
    const count = await deleteSubQuestion(req.params.subId);
    if (!count) return res.status(404).json({ error: 'Sub-question not found' });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete sub-question' });
  }
};


export async function updateFull(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid question id' });
    }
    const out = await updateQuestionFull(id, req.body);
    return res.json(out);
  } catch (e) {
    console.error('updateQuestionFull error:', e);
    return res.status(e.status || 500).json({ error: e.message || 'Failed to update question' });
  }
}

