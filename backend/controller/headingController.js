// controllers/headingController.js
import { updateHeadingTitle } from '../models/headingModel.js';

export async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid heading id' });
    }

    const { title } = req.body;
    const updated = await updateHeadingTitle(id, title);
    return res.json(updated);
  } catch (e) {
    console.error('update heading error:', e);
    return res.status(e.status || 500).json({ error: e.message || 'Failed to update heading' });
  }
}
