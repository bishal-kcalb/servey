// models/headingModel.js
import db from '../db_connection/connection.js';

export async function updateHeadingTitle(id, title) {
  const trimmed = String(title || '').trim();
  if (!trimmed) {
    const err = new Error('Heading title is required');
    err.status = 400;
    throw err;
  }

  // Update and return the updated row
  const row = await db.oneOrNone(
    `UPDATE headings
        SET title = $2
      WHERE id = $1
      RETURNING id, survey_id, title`,
    [id, trimmed]
  );

  if (!row) {
    const err = new Error('Heading not found');
    err.status = 404;
    throw err;
  }

  return row; // { id, survey_id, title }
}
