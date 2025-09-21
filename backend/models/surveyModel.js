import db from '../db_connection/connection.js';

/** SURVEYS */
export const createSurvey = async ({ title, description }) => {
  return db.one(
    `INSERT INTO surveys (title, description)
     VALUES ($1, $2)
     RETURNING id, title, description, created_at`,
    [title, description ?? null]
  );
};

export const getSurveys = async () => {
  return db.any(
    `SELECT id, title, description, created_at
     FROM surveys
     ORDER BY id DESC`
  );
};

export const getSurveyById = async (surveyId) => {
  return db.oneOrNone(
    `SELECT id, title, description, created_at
     FROM surveys WHERE id=$1`,
    [surveyId]
  );
};

export const updateSurvey = async (surveyId, { title, description }) => {
  return db.one(
    `UPDATE surveys
     SET title = COALESCE($2, title),
         description = COALESCE($3, description)
     WHERE id=$1
     RETURNING id, title, description, created_at`,
    [surveyId, title ?? null, description ?? null]
  );
};

export const deleteSurvey = async (surveyId) => {
  return db.result(`DELETE FROM surveys WHERE id=$1`, [surveyId], r => r.rowCount);
};

/** HEADINGS */
export const addHeading = async ({ survey_id, title }) => {
  return db.one(
    `INSERT INTO headings (survey_id, title)
     VALUES ($1, $2)
     RETURNING id, survey_id, title`,
    [survey_id, title]
  );
};

export const getSurveyFullTree = async (surveyId) => {
  // Fetch survey + headings + questions + options + sub_questions in one go
  return db.tx(async t => {
    const survey = await t.oneOrNone(
      `SELECT id, title, description, created_at
       FROM surveys WHERE id=$1`, [surveyId]
    );
    if (!survey) return null;

    const headings = await t.any(
      `SELECT id, survey_id, title
       FROM headings WHERE survey_id=$1
       ORDER BY id`, [surveyId]
    );
    const headingIds = headings.map(h => h.id);

    const questions = headingIds.length
      ? await t.any(
          `SELECT id, heading_id, type, text, is_composite, is_required
           FROM questions
           WHERE heading_id IN ($1:csv)
           ORDER BY id`,
          [headingIds]
        )
      : [];

    const questionIds = questions.map(q => q.id);

    const options = questionIds.length
      ? await t.any(
          `SELECT id, question_id, option_text, is_other
           FROM question_options
           WHERE question_id IN ($1:csv)
           ORDER BY id`,
          [questionIds]
        )
      : [];

    const subs = questionIds.length
      ? await t.any(
          `SELECT id, parent_question_id, label, type
           FROM sub_questions
           WHERE parent_question_id IN ($1:csv)
           ORDER BY id`,
          [questionIds]
        )
      : [];

    // Stitch tree
    const questionsByHeading = {};
    headings.forEach(h => (questionsByHeading[h.id] = []));
    const optionsByQuestion = {};
    const subsByQuestion = {};
    questionIds.forEach(id => {
      optionsByQuestion[id] = [];
      subsByQuestion[id] = [];
    });
    options.forEach(o => optionsByQuestion[o.question_id]?.push(o));
    subs.forEach(s => subsByQuestion[s.parent_question_id]?.push(s));

    questions.forEach(q => {
      q.options = optionsByQuestion[q.id] || [];
      q.sub_questions = subsByQuestion[q.id] || [];
      questionsByHeading[q.heading_id]?.push(q);
    });

    const fullHeadings = headings.map(h => ({
      ...h,
      questions: questionsByHeading[h.id] || []
    }));

    return { ...survey, headings: fullHeadings };
  });
};





export const createSurveyFull = async (payload) => {
  const {
    title,
    description = null,
    headings = []
  } = payload;

  return db.tx(async t => {
    // 1) survey
    const survey = await t.one(
      `INSERT INTO surveys (title, description)
       VALUES ($1, $2)
       RETURNING id, title, description, created_at`,
      [title, description]
    );

    const headingsOut = [];

    // 2) headings
    for (const h of headings) {
      const heading = await t.one(
        `INSERT INTO headings (survey_id, title)
         VALUES ($1, $2)
         RETURNING id, survey_id, title`,
        [survey.id, h.title]
      );

      const questionsOut = [];

      // 3) questions under heading
      for (const q of (h.questions || [])) {
        const {
          type,
          text,
          is_composite = false,
          is_required = true,
          options = [],
          sub_questions = []
        } = q;

        const question = await t.one(
          `INSERT INTO questions (heading_id, type, text, is_composite, is_required)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, heading_id, type, text, is_composite, is_required`,
          [heading.id, type, text, is_composite, is_required]
        );

        // 4) options (checkbox etc.)
        let optionsOut = [];
        if (Array.isArray(options) && options.length && type === 'checkbox') {
          const queries = options.map(opt =>
            t.one(
              `INSERT INTO question_options (question_id, option_text, is_other)
               VALUES ($1, $2, $3)
               RETURNING id, question_id, option_text, is_other`,
              [question.id, opt.option_text, !!opt.is_other]
            )
          );
          optionsOut = await t.batch(queries);
        }

        // 5) sub-questions (composite)
        let subsOut = [];
        if (is_composite && Array.isArray(sub_questions) && sub_questions.length) {
          const subQueries = sub_questions.map(sq =>
            t.one(
              `INSERT INTO sub_questions (parent_question_id, label, type)
               VALUES ($1, $2, $3)
               RETURNING id, parent_question_id, label, type`,
              [question.id, sq.label, sq.type]
            )
          );
          subsOut = await t.batch(subQueries);
        }

        questionsOut.push({
          ...question,
          options: optionsOut,
          sub_questions: subsOut
        });
      }

      headingsOut.push({
        ...heading,
        questions: questionsOut
      });
    }

    return { ...survey, headings: headingsOut };
  });
};




export const updateSurveyFull = async (surveyId, payload) => {
  const {
    title,
    description = null,
    headings = []
  } = payload;

  return db.tx(async t => {
    // 1) ensure exists
    const existing = await t.oneOrNone(
      `SELECT id FROM surveys WHERE id=$1`,
      [surveyId]
    );
    if (!existing) {
      const err = new Error('Survey not found');
      err.status = 404;
      throw err;
    }

    // 2) update survey
    const survey = await t.one(
      `UPDATE surveys
       SET title=$2, description=$3
       WHERE id=$1
       RETURNING id, title, description, created_at`,
      [surveyId, title, description]
    );

    // 3) wipe old tree (cascade from headings -> questions -> options/subs)
    await t.none(`DELETE FROM headings WHERE survey_id=$1`, [surveyId]);

    const headingsOut = [];

    // 4) rebuild tree
    for (const h of headings) {
      const heading = await t.one(
        `INSERT INTO headings (survey_id, title)
         VALUES ($1, $2)
         RETURNING id, survey_id, title`,
        [survey.id, h.title]
      );

      const questionsOut = [];

      for (const q of (h.questions || [])) {
        const {
          type,
          text,
          is_composite = false,
          is_required = true,
          options = [],
          sub_questions = []
        } = q;

        const question = await t.one(
          `INSERT INTO questions (heading_id, type, text, is_composite, is_required)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, heading_id, type, text, is_composite, is_required`,
          [heading.id, type, text, is_composite, is_required]
        );

        let optionsOut = [];
        if (Array.isArray(options) && options.length && type === 'checkbox') {
          const optQueries = options.map(opt =>
            t.one(
              `INSERT INTO question_options (question_id, option_text, is_other)
               VALUES ($1, $2, $3)
               RETURNING id, question_id, option_text, is_other`,
              [question.id, opt.option_text, !!opt.is_other]
            )
          );
          optionsOut = await t.batch(optQueries);
        }

        let subsOut = [];
        if (is_composite && Array.isArray(sub_questions) && sub_questions.length) {
          const subQueries = sub_questions.map(sq =>
            t.one(
              `INSERT INTO sub_questions (parent_question_id, label, type)
               VALUES ($1, $2, $3)
               RETURNING id, parent_question_id, label, type`,
               [question.id, sq.label, sq.type]
            )
          );
          subsOut = await t.batch(subQueries);
        }

        questionsOut.push({
          ...question,
          options: optionsOut,
          sub_questions: subsOut
        });
      }

      headingsOut.push({
        ...heading,
        questions: questionsOut
      });
    }

    return { ...survey, headings: headingsOut };
  });
};



// List all surveyors
export async function listSurveyors() {
  const rows = await db.any(
    `SELECT id, name, email
       FROM users
      WHERE role = 'surveyor'
      ORDER BY name ASC`
  );
  return rows;
}

// Assign (insert, ignoring duplicates)
export async function assignSurveyToSurveyor({ survey_id, surveyor_id, assigned_by = null }) {
  const row = await db.one(
    `INSERT INTO survey_assignments (survey_id, surveyor_id, assigned_by)
     VALUES ($1,$2,$3)
     ON CONFLICT (survey_id, surveyor_id) DO UPDATE
       SET assigned_at = EXCLUDED.assigned_at
     RETURNING *`,
    [survey_id, surveyor_id, assigned_by]
  );
  return row;
}

// List assignees for a survey
export async function listSurveyAssignees(survey_id) {
  const rows = await db.any(
    `SELECT sa.id,
            sa.survey_id,
            sa.surveyor_id,
            sa.assigned_by,
            sa.assigned_at,
            u.name  AS surveyor_name,
            u.email AS surveyor_email
       FROM survey_assignments sa
       JOIN users u ON u.id = sa.surveyor_id
      WHERE sa.survey_id = $1
      ORDER BY u.name ASC`,
    [survey_id]
  );
  return rows;
}

// Optional: unassign
export async function unassignSurveyor({ survey_id, surveyor_id }) {
  const res = await db.result(
    `DELETE FROM survey_assignments
      WHERE survey_id = $1 AND surveyor_id = $2`,
    [survey_id, surveyor_id],
    r => r.rowCount
  );
  return res; // number of rows removed
}


