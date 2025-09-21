import db from "../db_connection/connection.js";

const schema = `
-- required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL,
  email   TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role     TEXT CHECK (role IN ('admin', 'surveyor')) NOT NULL,
  password_reset_code_hash    TEXT,
  password_reset_expires_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS surveys (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  user_id INT REFERENCES users(id), 
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_assignments (
  id           SERIAL PRIMARY KEY,
  survey_id    INT NOT NULL REFERENCES surveys(id)  ON DELETE CASCADE,
  surveyor_id  INT NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  assigned_by  INT     REFERENCES users(id)         ON DELETE SET NULL, -- admin who assigned (optional)
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (survey_id, surveyor_id)
);

CREATE TABLE IF NOT EXISTS headings (
  id        SERIAL PRIMARY KEY,
  survey_id INT REFERENCES surveys(id) ON DELETE CASCADE,
  title     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id          SERIAL PRIMARY KEY,
  heading_id  INT REFERENCES headings(id) ON DELETE CASCADE,
  type        TEXT CHECK (type IN ('input', 'yes_no', 'checkbox', 'audio', 'video')) NOT NULL,
  text        TEXT NOT NULL,
  is_composite BOOLEAN DEFAULT FALSE,
  is_required  BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sub_questions (
  id                 SERIAL PRIMARY KEY,
  parent_question_id INT REFERENCES questions(id) ON DELETE CASCADE,
  label              TEXT NOT NULL,
  type TEXT CHECK (type IN ('input', 'yes_no', 'checkbox')) NOT NULL
);

CREATE TABLE IF NOT EXISTS question_options (
  id          SERIAL PRIMARY KEY,
  question_id INT REFERENCES questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_other    BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS response_submissions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  INT REFERENCES users(id) ON DELETE SET NULL,
  survey_id                INT REFERENCES surveys(id) ON DELETE CASCADE,
  responser_name           TEXT,
  responser_location       TEXT,
  responser_house_image_url TEXT,
  responser_photo          TEXT,
  responser_gender         TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_responses (
  id                 SERIAL PRIMARY KEY,
  submission_id      UUID REFERENCES response_submissions(id) ON DELETE CASCADE,
  question_id        INT REFERENCES questions(id) ON DELETE CASCADE,
  selected_option_id INT REFERENCES question_options(id) ON DELETE SET NULL,
  sub_question_id    INT REFERENCES sub_questions(id) ON DELETE SET NULL,
  custom_answer      TEXT,
  audio_url          TEXT,
  video_url          TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id         SERIAL PRIMARY KEY,
  user_id    INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  phone      TEXT,
  address    TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_survey_heading         ON headings(survey_id);
CREATE INDEX IF NOT EXISTS idx_heading_question       ON questions(heading_id);
CREATE INDEX IF NOT EXISTS idx_question_option        ON question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_question_subquestion   ON sub_questions(parent_question_id);
CREATE INDEX IF NOT EXISTS idx_question_responses_qid ON question_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_assignments_survey     ON survey_assignments(survey_id);
CREATE INDEX IF NOT EXISTS idx_assignments_surveyor   ON survey_assignments(surveyor_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assignedby ON survey_assignments(assigned_by);
`;

db.none(schema)
  .then(() => console.log('✅ Schema created successfully'))
  .catch(err => console.error('❌ Error:', err));
