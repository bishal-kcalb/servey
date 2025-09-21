import db from '../db_connection/connection.js';

/** Create question (supports options + sub_questions via tx) */
export const createQuestion = async ({
  heading_id,
  type,
  text,
  is_composite = false,
  is_required = true,
  options = [],           // [{ option_text, is_other }]
  sub_questions = []      // [{ label, type }]
}) => {
  return db.tx(async t => {
    const q = await t.one(
      `INSERT INTO questions (heading_id, type, text, is_composite, is_required)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, heading_id, type, text, is_composite, is_required`,
      [heading_id, type, text, is_composite, is_required]
    );

    if (options?.length && (type === 'checkbox')) {
      const queries = options.map(opt =>
        t.none(
          `INSERT INTO question_options (question_id, option_text, is_other)
           VALUES ($1, $2, $3)`,
          [q.id, opt.option_text, !!opt.is_other]
        )
      );
      await t.batch(queries);
    }

    if (is_composite && sub_questions?.length) {
      const queries = sub_questions.map(sq =>
        t.none(
          `INSERT INTO sub_questions (parent_question_id, label, type)
           VALUES ($1, $2, $3)`,
          [q.id, sq.label, sq.type]
        )
      );
      await t.batch(queries);
    }
    return q;
  });
};

export const getQuestionById = async (id) => {
  return db.tx(async t => {
    const q = await t.oneOrNone(
      `SELECT id, heading_id, type, text, is_composite, is_required
       FROM questions WHERE id=$1`, [id]
    );
    if (!q) return null;

    const [options, subs] = await t.batch([
      t.any(`SELECT id, question_id, option_text, is_other
             FROM question_options WHERE question_id=$1 ORDER BY id`, [id]),
      t.any(`SELECT id, parent_question_id, label, type
             FROM sub_questions WHERE parent_question_id=$1 ORDER BY id`, [id]),
    ]);

    return { ...q, options, sub_questions: subs };
  });
};

export const updateQuestion = async (id, attrs) => {
  // Update basic fields; options/subs typically managed with separate endpoints
  const { type, text, is_composite, is_required } = attrs;
  return db.one(
    `UPDATE questions
     SET type = COALESCE($2, type),
         text = COALESCE($3, text),
         is_composite = COALESCE($4, is_composite),
         is_required = COALESCE($5, is_required)
     WHERE id=$1
     RETURNING id, heading_id, type, text, is_composite, is_required`,
    [id, type ?? null, text ?? null, is_composite ?? null, is_required ?? null]
  );
};

export const deleteQuestion = async (id) => {
  return db.result(`DELETE FROM questions WHERE id=$1`, [id], r => r.rowCount);
};

/** Manage options */
export const addOption = async (question_id, { option_text, is_other = false }) => {
  return db.one(
    `INSERT INTO question_options (question_id, option_text, is_other)
     VALUES ($1, $2, $3)
     RETURNING id, question_id, option_text, is_other`,
    [question_id, option_text, is_other]
  );
};

export const deleteOption = async (optionId) => {
  return db.result(`DELETE FROM question_options WHERE id=$1`, [optionId], r => r.rowCount);
};

/** Manage sub-questions */
export const addSubQuestion = async (parent_question_id, { label, type }) => {
  return db.one(
    `INSERT INTO sub_questions (parent_question_id, label, type)
     VALUES ($1, $2, $3)
     RETURNING id, parent_question_id, label, type`,
    [parent_question_id, label, type]
  );
};

export const deleteSubQuestion = async (subId) => {
  return db.result(`DELETE FROM sub_questions WHERE id=$1`, [subId], r => r.rowCount);
};




const VALID_Q_TYPES = ['input', 'yes_no', 'checkbox', 'audio', 'video'];
const VALID_SUB_TYPES = ['input', 'yes_no', 'checkbox'];

export async function updateQuestionFull(questionId, payload) {
  const {
    text,
    type,
    is_required = true,
    is_composite = false,
    options = [],
    sub_questions = [],
  } = payload || {};

  if (!text || !String(text).trim()) {
    const e = new Error('Question text is required');
    e.status = 400;
    throw e;
  }
  if (!VALID_Q_TYPES.includes(type)) {
    const e = new Error(`Invalid question type. Allowed: ${VALID_Q_TYPES.join(', ')}`);
    e.status = 400;
    throw e;
  }

  // Validate sub-question types up front (if provided)
  for (const s of sub_questions) {
    if (!VALID_SUB_TYPES.includes(s.type)) {
      const e = new Error(`Invalid sub-question type "${s.type}". Allowed: ${VALID_SUB_TYPES.join(', ')}`);
      e.status = 400;
      throw e;
    }
  }

  return db.tx(async t => {
    // 1) Ensure question exists
    const existing = await t.oneOrNone(
      `SELECT id, heading_id, type, text, is_required, is_composite
       FROM questions WHERE id = $1`,
      [questionId]
    );
    if (!existing) {
      const e = new Error('Question not found');
      e.status = 404;
      throw e;
    }

    // 2) Update core fields
    const q = await t.one(
      `UPDATE questions
         SET text = $2,
             type = $3,
             is_required = $4,
             is_composite = $5
       WHERE id = $1
       RETURNING id, heading_id, type, text, is_required, is_composite`,
      [questionId, String(text).trim(), type, !!is_required, !!is_composite]
    );

    // 3) OPTIONS
    let optionsOut = [];
    if (type === 'checkbox') {
      // current on server
      const currentOpts = await t.manyOrNone(
        `SELECT id, question_id, option_text, is_other
           FROM question_options
          WHERE question_id = $1
          ORDER BY id`,
        [q.id]
      );

      // normalize client list: [{id?, option_text, is_other}]
      const clientOpts = (options || []).map(o => ({
        id: o.id ?? null,
        option_text: String(o.option_text || '').trim(),
        is_other: !!o.is_other
      })).filter(o => o.option_text.length > 0);

      const serverById = new Map(currentOpts.map(o => [o.id, o]));
      const clientById = new Map(clientOpts.filter(o => o.id).map(o => [o.id, o]));

      // Deletes: present on server, missing on client
      const toDelete = currentOpts.filter(o => !clientById.has(o.id));
      // Updates: present on both but changed
      const toUpdate = clientOpts.filter(o =>
        o.id && serverById.has(o.id) && (
          o.option_text !== serverById.get(o.id).option_text ||
          o.is_other !== serverById.get(o.id).is_other
        )
      );
      // Creates: no id
      const toCreate = clientOpts.filter(o => !o.id);

      await t.batch([
        ...toDelete.map(o =>
          t.none(`DELETE FROM question_options WHERE id=$1`, [o.id])
        ),
        ...toUpdate.map(o =>
          t.none(
            `UPDATE question_options
                SET option_text=$2, is_other=$3
              WHERE id=$1`,
            [o.id, o.option_text, o.is_other]
          )
        ),
        ...toCreate.map(o =>
          t.one(
            `INSERT INTO question_options (question_id, option_text, is_other)
             VALUES ($1, $2, $3)
             RETURNING id, question_id, option_text, is_other`,
            [q.id, o.option_text, o.is_other]
          )
        )
      ]);

      // re-read
      optionsOut = await t.manyOrNone(
        `SELECT id, question_id, option_text, is_other
           FROM question_options
          WHERE question_id=$1
          ORDER BY id`,
        [q.id]
      );
    } else {
      // if type changed away from checkbox → remove all options
      await t.none(`DELETE FROM question_options WHERE question_id=$1`, [q.id]);
      optionsOut = [];
    }

    // 4) SUB-QUESTIONS
    let subsOut = [];
    if (is_composite) {
      const currentSubs = await t.manyOrNone(
        `SELECT id, parent_question_id, label, type
           FROM sub_questions
          WHERE parent_question_id=$1
          ORDER BY id`,
        [q.id]
      );

      const clientSubs = (sub_questions || []).map(s => ({
        id: s.id ?? null,
        label: String(s.label || '').trim(),
        type: s.type
      })).filter(s => s.label.length > 0);

      const serverByIdS = new Map(currentSubs.map(s => [s.id, s]));
      const clientByIdS = new Map(clientSubs.filter(s => s.id).map(s => [s.id, s]));

      const toDeleteS = currentSubs.filter(s => !clientByIdS.has(s.id));
      const toUpdateS = clientSubs.filter(s =>
        s.id && serverByIdS.has(s.id) && (
          s.label !== serverByIdS.get(s.id).label ||
          s.type !== serverByIdS.get(s.id).type
        )
      );
      const toCreateS = clientSubs.filter(s => !s.id);

      await t.batch([
        ...toDeleteS.map(s =>
          t.none(`DELETE FROM sub_questions WHERE id=$1`, [s.id])
        ),
        ...toUpdateS.map(s =>
          t.none(
            `UPDATE sub_questions
                SET label=$2, type=$3
              WHERE id=$1`,
            [s.id, s.label, s.type]
          )
        ),
        ...toCreateS.map(s =>
          t.one(
            `INSERT INTO sub_questions (parent_question_id, label, type)
             VALUES ($1, $2, $3)
             RETURNING id, parent_question_id, label, type`,
            [q.id, s.label, s.type]
          )
        )
      ]);

      subsOut = await t.manyOrNone(
        `SELECT id, parent_question_id, label, type
           FROM sub_questions
          WHERE parent_question_id=$1
          ORDER BY id`,
        [q.id]
      );
    } else {
      await t.none(`DELETE FROM sub_questions WHERE parent_question_id=$1`, [q.id]);
      subsOut = [];
    }

    return {
      ...q,
      options: optionsOut,
      sub_questions: subsOut
    };
  });
}

