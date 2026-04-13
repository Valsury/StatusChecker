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
    created_at TIMESTAMP DEFAULT NOW()
  )
`).catch(console.error);

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
  const { date, rating, note } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO records (date, rating, note) VALUES ($1, $2, $3) RETURNING *',
      [date, rating, note || null]
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

    // Streak — текущая серия (дней подряд с записями)
    const dates = await pool.query(`
      SELECT DISTINCT date::date as d FROM records ORDER BY d DESC
    `);
    let streak = 0;
    if (dates.rows.length) {
      const today = new Date(); today.setHours(0,0,0,0);
      let cursor = new Date(dates.rows[0].d); cursor.setHours(0,0,0,0);
      const diff = Math.round((today - cursor) / 86400000);
      if (diff <= 1) {
        streak = 1;
        for (let i = 1; i < dates.rows.length; i++) {
          const prev = new Date(dates.rows[i].d); prev.setHours(0,0,0,0);
          const gap  = Math.round((cursor - prev) / 86400000);
          if (gap === 1) { streak++; cursor = prev; } else break;
        }
      }
    }

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
