// app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv'
import path from 'path';
import db from './db_connection/connection.js';
import user from './routes/user.js';
import survey from './routes/surveyRoutes.js';
import question from './routes/questionRoutes.js';
import headingRoutes from './routes/headingRoutes.js';
import responsesRouter from './routes/responseRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import profileRoutes from './routes/profile.js';
import adminRoutes from './routes/admin.js';

const app = express();
app.use(express.json());
dotenv.config();

app.get('/test-db', async (req, res) => {
  try {
    const result = await db.one('SELECT $1 AS value', [456]);
    res.json({ value: result.value });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.use(cors({
    // origin:'http://localhost',
    credentials: true
}))


app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/admin', adminRoutes);
app.use('/user', user)
app.use('/survey', survey)
app.use('/question', question)
app.use('/headings', headingRoutes);
app.use('/', responsesRouter); // or app.use('/api', responsesRouter);
app.use('/uploads', uploadRoutes);
app.use('/', profileRoutes);

app.listen(3003, '0.0.0.0', () => console.log('API on 0.0.0.0:3003'));