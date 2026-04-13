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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
