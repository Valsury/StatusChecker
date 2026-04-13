require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Init table
pool.query(`
  CREATE TABLE IF NOT EXISTS records (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
    note TEXT,
    tags TEXT[],
    mood_before INTEGER CHECK (mood_before >= 1 AND mood_before <= 5),
    mood_after  INTEGER CHECK (mood_after  >= 1 AND mood_after  <= 5),
    duration_min INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
  )
`).then(() => {
  // migrate existing table — add columns if missing
  return pool.query(`
    ALTER TABLE records
      ADD COLUMN IF NOT EXISTS tags TEXT[],
      ADD COLUMN IF NOT EXISTS mood_before INTEGER,
      ADD COLUMN IF NOT EXISTS mood_after  INTEGER,
      ADD COLUMN IF NOT EXISTS duration_min INTEGER
  `);
}).catch(console.error);

// GET all records
app.get('/api/records', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM records ORDER BY date DESC');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST new record
app.post('/api/records', async (req, res) => {
  const { date, rating, note, tags, mood_before, mood_after, duration_min } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO records (date, rating, note, tags, mood_before, mood_after, duration_min)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [date, rating, note || null, tags || null, mood_before || null, mood_after || null, duration_min || null]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH record
app.patch('/api/records/:id', async (req, res) => {
  const { date, rating, note, duration_min } = req.body;
  try {
    const result = await pool.query(
      `UPDATE records SET date=$1, rating=$2, note=$3, duration_min=$4 WHERE id=$5 RETURNING *`,
      [date, rating, note || null, duration_min || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE record
app.delete('/api/records/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM records WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET stats
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        ROUND(AVG(rating), 1) as avg_rating,
        MAX(rating) as best_rating,
        MAX(date) as last_date
      FROM records
    `);
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET analytics
app.get('/api/analytics', async (_req, res) => {
  try {
    // По месяцам (последние 6)
    const byMonth = await pool.query(`
      SELECT TO_CHAR(date, 'YYYY-MM') as month, COUNT(*) as count, ROUND(AVG(rating),1) as avg_rating
      FROM records
      GROUP BY month ORDER BY month DESC LIMIT 6
    `);

    // По дням недели
    const byWeekday = await pool.query(`
      SELECT EXTRACT(DOW FROM date) as dow, COUNT(*) as count
      FROM records GROUP BY dow ORDER BY dow
    `);

    // Распределение оценок
    const ratingDist = await pool.query(`
      SELECT rating, COUNT(*) as count FROM records GROUP BY rating ORDER BY rating
    `);

    // Streak — максимальная серия дней подряд за всё время
    const dates = await pool.query(`
      SELECT DISTINCT date::date as d FROM records ORDER BY d ASC
    `);
    let streak = 0;
    let currentStreak = 0;
    let maxStreak = 0;

    for (let i = 0; i < dates.rows.length; i++) {
      if (i === 0) {
        currentStreak = 1;
      } else {
        const prev = new Date(dates.rows[i - 1].d); prev.setHours(0,0,0,0);
        const curr = new Date(dates.rows[i].d);     curr.setHours(0,0,0,0);
        const gap  = Math.round((curr - prev) / 86400000);
        if (gap === 1) { currentStreak++; }
        else           { currentStreak = 1; }
      }
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    }
    streak = maxStreak;

    res.json({
      byMonth:   byMonth.rows.reverse(),
      byWeekday: byWeekday.rows,
      ratingDist: ratingDist.rows,
      streak
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
