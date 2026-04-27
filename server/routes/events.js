const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, requireAuth, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET /api/events (Public to read within org)
router.get('/', async (req, res) => {
  try {
    let query = 'SELECT * FROM events';
    let params = [];
    if (req.user && req.user.role !== 'SuperAdmin') {
      query += ' WHERE organization_id = $1 ORDER BY event_date ASC, start_time ASC';
      params = [req.user.organization_id];
    } else if (!req.user) {
      query += ' WHERE organization_id = 1 ORDER BY event_date ASC, start_time ASC';
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// POST /api/events
router.post('/', requireAuth, requireRole(['OrgAdmin', 'SuperAdmin']), async (req, res) => {
  try {
    const { name, event_date, start_time, end_time } = req.body;
    const orgId = req.user.role === 'SuperAdmin' ? (req.body.organization_id || 1) : req.user.organization_id;
    const result = await pool.query(
      'INSERT INTO events (organization_id, name, event_date, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [orgId, name, event_date, start_time, end_time]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// PUT /api/events/:id
router.put('/:id', requireAuth, requireRole(['OrgAdmin', 'SuperAdmin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, event_date, start_time, end_time } = req.body;
    
    if (req.user.role !== 'SuperAdmin') {
      const check = await pool.query('SELECT organization_id FROM events WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].organization_id !== req.user.organization_id) return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await pool.query(
      'UPDATE events SET name = $1, event_date = $2, start_time = $3, end_time = $4 WHERE id = $5 RETURNING *',
      [name, event_date, start_time, end_time, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// DELETE /api/events/:id
router.delete('/:id', requireAuth, requireRole(['OrgAdmin', 'SuperAdmin']), async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'SuperAdmin') {
      const check = await pool.query('SELECT organization_id FROM events WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].organization_id !== req.user.organization_id) return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM events WHERE id = $1', [id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

module.exports = router;
