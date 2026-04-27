const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, requireAuth, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET /api/ministries (Public to read within org)
router.get('/', async (req, res) => {
  try {
    let query = 'SELECT * FROM ministries';
    let params = [];
    if (req.user && req.user.role !== 'SuperAdmin') {
      query += ' WHERE organization_id = $1';
      params = [req.user.organization_id];
    } else if (!req.user) {
      // For public unauthenticated access, default to org 1
      query += ' WHERE organization_id = 1';
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// POST /api/ministries
router.post('/', requireAuth, requireRole(['OrgAdmin', 'SuperAdmin']), async (req, res) => {
  try {
    const { title, description } = req.body;
    const orgId = req.user.role === 'SuperAdmin' ? (req.body.organization_id || 1) : req.user.organization_id;
    const result = await pool.query(
      'INSERT INTO ministries (organization_id, title, description) VALUES ($1, $2, $3) RETURNING *',
      [orgId, title, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// PUT /api/ministries/:id
router.put('/:id', requireAuth, requireRole(['OrgAdmin', 'SuperAdmin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    
    if (req.user.role !== 'SuperAdmin') {
      const check = await pool.query('SELECT organization_id FROM ministries WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].organization_id !== req.user.organization_id) return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await pool.query(
      'UPDATE ministries SET title = $1, description = $2 WHERE id = $3 RETURNING *',
      [title, description, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// DELETE /api/ministries/:id
router.delete('/:id', requireAuth, requireRole(['OrgAdmin', 'SuperAdmin']), async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'SuperAdmin') {
      const check = await pool.query('SELECT organization_id FROM ministries WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].organization_id !== req.user.organization_id) return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM ministries WHERE id = $1', [id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

module.exports = router;
