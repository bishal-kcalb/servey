// server/models/adminModel.js
import db from '../db_connection/connection.js';

/** Count surveyors */
export async function getTotalSurveyors() {
  const { count } = await db.one(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'surveyor'`);
  return count;
}

/** Count surveys */
export async function getTotalSurveys() {
  const { count } = await db.one(`SELECT COUNT(*)::int AS count FROM surveys`);
  return count;
}

/** Active surveys (activity in last 30 days) */
export async function getActiveSurveys(days = 30) {
  const { count } = await db.one(
    `
    SELECT COUNT(DISTINCT survey_id)::int AS count
    FROM response_submissions
    WHERE created_at >= NOW() - INTERVAL '${days} days'
    `
  );
  return count;
}

/** Total responses = number of submissions */
export async function getTotalResponses() {
  const { count } = await db.one(
    `SELECT COUNT(*)::int AS count FROM response_submissions`
  );
  return count;
}

/**
 * Completion rate:
 * % of submissions where all REQUIRED questions of that survey
 * have at least one response (option/custom/audio/video).
 */
export async function getCompletionRate() {
  const { rate } = await db.one(
    `
    WITH required_q AS (
      SELECT q.id, h.survey_id
      FROM questions q
      JOIN headings h ON h.id = q.heading_id
      WHERE q.is_required = TRUE
    ),
    per_submission AS (
      SELECT
        s.id AS submission_id,
        s.survey_id,
        (SELECT COUNT(*) FROM required_q rq WHERE rq.survey_id = s.survey_id) AS req_cnt,
        (
          SELECT COUNT(DISTINCT rq.id)
          FROM required_q rq
          LEFT JOIN question_responses r
            ON r.question_id = rq.id
           AND r.submission_id = s.id
          WHERE rq.survey_id = s.survey_id
            AND (
              r.selected_option_id IS NOT NULL
              OR r.custom_answer IS NOT NULL
              OR r.audio_url IS NOT NULL
              OR r.video_url IS NOT NULL
            )
        ) AS answered_cnt
      FROM response_submissions s
    ),
    flagged AS (
      SELECT CASE
               WHEN req_cnt = 0 THEN NULL -- survey has no required qs
               WHEN answered_cnt >= req_cnt THEN 1
               ELSE 0
             END AS is_complete
      FROM per_submission
    )
    SELECT
      COALESCE(ROUND(AVG(is_complete::numeric) * 100), 0)::int AS rate
    FROM flagged
    WHERE is_complete IS NOT NULL
    `
  );
  return rate;
}

/** Top 3 surveys by submissions (for bar chart) */
export async function getTopParticipation(limit = 3) {
  const rows = await db.any(
    `
    SELECT s.id, s.title, COUNT(rs.id)::int AS submissions
    FROM surveys s
    LEFT JOIN response_submissions rs ON rs.survey_id = s.id
    GROUP BY s.id, s.title
    ORDER BY submissions DESC, s.created_at DESC
    LIMIT $1
    `,
    [limit]
  );
  return rows; // [{id,title,submissions}]
}

/**
 * Answer distribution (Yes/No/Neutral) for a given survey:
 * We look at YES/NO questions (type 'yes_no'), and treat all non-yes/no as Neutral.
 */
export async function getAnswerDistribution(surveyId) {
  const rows = await db.any(
    `
    WITH yn_q AS (
      SELECT q.id
      FROM questions q
      JOIN headings h ON h.id = q.heading_id
      WHERE h.survey_id = $1 AND q.type = 'yes_no'
    ),
    answers AS (
      SELECT
        LOWER(COALESCE(o.option_text, r.custom_answer)) AS val
      FROM question_responses r
      JOIN yn_q ON yn_q.id = r.question_id
      LEFT JOIN question_options o ON o.id = r.selected_option_id
    )
    SELECT
      SUM(CASE WHEN val IN ('yes','y','true') THEN 1 ELSE 0 END)::int AS yes_cnt,
      SUM(CASE WHEN val IN ('no','n','false') THEN 1 ELSE 0 END)::int AS no_cnt,
      SUM(CASE WHEN val IS NULL OR val NOT IN ('yes','y','true','no','n','false') THEN 1 ELSE 0 END)::int AS neutral_cnt
    FROM answers
    `,
    [surveyId]
  );
  const { yes_cnt = 0, no_cnt = 0, neutral_cnt = 0 } = rows?.[0] || {};
  return { yes: yes_cnt, no: no_cnt, neutral: neutral_cnt };
}

/** Recent surveys + status */
export async function getRecentSurveys(limit = 3) {
  const rows = await db.any(
    `
    SELECT
      s.id,
      s.title,
      s.description,
      s.created_at,
      (
        SELECT COUNT(*)::int
        FROM response_submissions rs
        WHERE rs.survey_id = s.id
      ) AS resp_count,
      (
        SELECT COUNT(*)::int
        FROM response_submissions rs
        WHERE rs.survey_id = s.id
          AND rs.created_at >= NOW() - INTERVAL '30 days'
      ) AS recent_count
    FROM surveys s
    ORDER BY s.created_at DESC
    LIMIT $1
    `,
    [limit]
  );

  // status heuristic:
  // Active if recent responses in last 30 days; else Completed
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    responses: r.resp_count,
    status: r.recent_count > 0 ? 'Active' : 'Completed',
    created_at: r.created_at,
  }));
}


/** Get all completed surveys from all users */
export async function getAllCompletedSurveys() {
  const rows = await db.any(
    `
    SELECT
      s.id AS survey_id,
      s.title AS survey_title,
      COUNT(DISTINCT rs.id)::int AS answers_count,
      MAX(rs.created_at) AS submitted_at
    FROM surveys s
    JOIN response_submissions rs ON rs.survey_id = s.id
    GROUP BY s.id, s.title
    ORDER BY submitted_at DESC NULLS LAST
    `
  );

  return rows;
}


export async function getResponsesBySurveyAllUsers(surveyId) {
  const rows = await db.any(
    `
    SELECT
      rs.id                             AS submission_id,         -- UUID
      rs.survey_id,
      s.title                           AS survey_title,

      -- respondent (what you want to show in lists)
      rs.responser_name,
      rs.responser_location,
      rs.responser_house_image_url,
      rs.responser_photo,
      rs.created_at                     AS submitted_at,

      -- (optional) surveyor (who collected it)
      u.id                              AS user_id,
      u.name                            AS user_name,
      u.email                           AS user_email,

      COALESCE(COUNT(qr.id), 0)::int    AS answers_count
    FROM response_submissions rs
    JOIN surveys s
      ON s.id = rs.survey_id
    LEFT JOIN users u
      ON u.id = rs.user_id
    LEFT JOIN question_responses qr
      ON qr.submission_id = rs.id
    WHERE rs.survey_id = $1
    GROUP BY
      rs.id, rs.survey_id, s.title,
      rs.responser_name, rs.responser_location,
      rs.responser_house_image_url, rs.responser_photo, rs.created_at,
      u.id, u.name, u.email
    ORDER BY rs.created_at DESC
    `,
    [Number(surveyId)]
  );

  // Return shape your RN list expects (respondent-first)
  return rows.map(r => ({
    submission_id: r.submission_id,
    survey_id: r.survey_id,
    survey_title: r.survey_title,

    responser_name: r.responser_name,
    responser_location: r.responser_location,
    responser_house_image_url: r.responser_house_image_url,
    responser_photo: r.responser_photo,

    submitted_at: r.submitted_at,
    answers_count: r.answers_count,

    // keep surveyor info if you want to show it somewhere else
    user: {
      id: r.user_id,
      name: r.user_name,
      email: r.user_email,
    },
  }));
}