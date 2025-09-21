// models/responseModel.js
import db from '../db_connection/connection.js';

export async function createSubmission(t, { user_id, survey_id, responser }) {
  return t.one(
    `
    INSERT INTO response_submissions
      (user_id, survey_id, responser_name, responser_location, responser_house_image_url, responser_photo)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING id, created_at
    `,
    [
      user_id ?? null,
      survey_id,
      responser?.name ?? null,
      responser?.location ?? null,
      responser?.house_image_url ?? null,
      responser?.photo_url ?? null,
    ]
  );
}

export async function insertAnswers(t, submission_id, answers) {
  const rows = (answers || [])
    .map(a => ({
      submission_id,
      question_id: a?.question_id ? Number(a.question_id) : null,
      selected_option_id: a?.selected_option_id ? Number(a.selected_option_id) : null,
      sub_question_id: a?.sub_question_id ? Number(a.sub_question_id) : null,
      custom_answer: a?.custom_answer ?? null,
      audio_url: a?.audio_url ?? null,
      video_url: a?.video_url ?? null,
      created_at: new Date(),
    }))
    .filter(r =>
      r.question_id &&
      (r.selected_option_id || (r.custom_answer && r.custom_answer.trim()) || r.audio_url || r.video_url)
    );

  if (!rows.length) return { inserted: 0 };

  const cols = [
    'submission_id','question_id','selected_option_id','sub_question_id',
    'custom_answer','audio_url','video_url','created_at'
  ];

  const values = [];
  const tuples = rows.map((r, idx) => {
    const base = idx * cols.length;
    values.push(
      r.submission_id, r.question_id, r.selected_option_id, r.sub_question_id,
      r.custom_answer, r.audio_url, r.video_url, r.created_at
    );
    return `(${cols.map((_, i) => `$${base + i + 1}`).join(',')})`;
  });

  await t.none(
    `INSERT INTO question_responses (${cols.join(',')}) VALUES ${tuples.join(',')}`,
    values
  );

  return { inserted: rows.length };
}

/** List all submissions created by a surveyor (grouped by survey) */
export async function listMySubmissions(user_id) {
  return db.any(
    `
    SELECT
      rs.id           AS submission_id,
      rs.survey_id,
      s.title         AS survey_title,
      rs.created_at   AS submitted_at,
      rs.responser_name,
      rs.responser_location,
      (SELECT COUNT(*) FROM question_responses qr WHERE qr.submission_id = rs.id) AS answers_count
    FROM response_submissions rs
    JOIN surveys s ON s.id = rs.survey_id
    WHERE rs.user_id = $1
    ORDER BY rs.created_at DESC
    `,
    [user_id]
  );
}

/** List submissions for a specific survey by this user */
export async function listMySubmissionsBySurvey(user_id, survey_id) {
  return db.any(
    `
    SELECT
      rs.id           AS submission_id,
      rs.survey_id,
      s.title         AS survey_title,
      rs.created_at   AS submitted_at,
      rs.responser_name,
      rs.responser_location,
      (SELECT COUNT(*) FROM question_responses qr WHERE qr.submission_id = rs.id) AS answers_count
    FROM response_submissions rs
    JOIN surveys s ON s.id = rs.survey_id
    WHERE rs.user_id = $1 AND rs.survey_id = $2
    ORDER BY rs.created_at DESC
    `,
    [user_id, survey_id]
  );
}



export async function getMySurveySummariesViaJoins(userId) {
  return db.any(
    `
    SELECT
      s.id                AS survey_id,
      s.title             AS survey_title,
      COUNT(*)            AS answers_count,
      MAX(r.created_at)   AS submitted_at
    FROM question_responses r
    JOIN questions q ON q.id = r.question_id
    JOIN headings  h ON h.id = q.heading_id
    JOIN surveys   s ON s.id = h.survey_id
    WHERE r.user_id = $1
    GROUP BY s.id, s.title
    ORDER BY submitted_at DESC NULLS LAST
    `,
    [userId]
  );
}



export async function getMySurveySummaries(userId) {
  return db.any(
    `
    SELECT
      s.id              AS survey_id,
      s.title           AS survey_title,
      COUNT(DISTINCT rs.id)       AS answers_count,     -- total answer rows by this user for this survey
      MAX(rs.created_at) AS submitted_at
    FROM response_submissions rs
    JOIN surveys s               ON s.id = rs.survey_id
    JOIN question_responses r    ON r.submission_id = rs.id
    WHERE rs.user_id = $1
    GROUP BY s.id, s.title
    ORDER BY submitted_at DESC NULLS LAST
    `,
    [userId]
  );
}

/**
 * List all submissions (one row per submission) by this user for a given survey.
 */
export async function getMySubmissionsForSurvey(userId, surveyId) {
  return db.any(
    `
    SELECT
      rs.id,
      rs.created_at,
      rs.responser_name,
      rs.responser_location,
      rs.responser_house_image_url,
      rs.responser_photo
    FROM response_submissions rs
    WHERE rs.user_id = $1
      AND rs.survey_id = $2
    ORDER BY rs.created_at DESC
    `,
    [userId, surveyId]
  );
}

/**
 * Detailed responses for a single submission (one row per answer).
 */
export async function getSubmissionDetails(submissionId) {
  return db.any(
    `
    SELECT
      r.id                 AS response_id,
      r.question_id,
      q.text               AS question_text,
      q.type               AS question_type,
      r.selected_option_id,
      qo.option_text       AS selected_option_text,
      r.sub_question_id,
      sq.label             AS sub_question_label,
      sq.type              AS sub_question_type,
      r.custom_answer,
      r.audio_url,
      r.video_url,
      r.created_at
    FROM question_responses r
    JOIN questions q           ON q.id = r.question_id
    LEFT JOIN question_options qo ON qo.id = r.selected_option_id
    LEFT JOIN sub_questions  sq   ON sq.id = r.sub_question_id
    WHERE r.submission_id = $1
    ORDER BY r.created_at, r.id
    `,
    [submissionId]
  );
}