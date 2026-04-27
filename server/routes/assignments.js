const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, requireAuth, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET /api/assignments
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = `
      SELECT 
        a.id AS assignment_id, a.status, a.created_at,
        u.id AS user_id, u.name AS user_name, u.email AS user_email, u.role AS user_role,
        m.id AS ministry_id, m.title AS ministry_title,
        e.id AS event_id, e.name AS event_name, e.event_date, e.start_time, e.end_time
      FROM assignments a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN ministries m ON u.ministry_id = m.id
      JOIN events e ON a.event_id = e.id
      WHERE 1=1
    `;
    let params = [];
    
    if (req.user.role === 'SuperAdmin') {
      // no filter
    } else if (req.user.role === 'OrgAdmin') {
      query += ` AND a.organization_id = $1`;
      params.push(req.user.organization_id);
    } else if (req.user.role === 'MinistryLeader') {
      query += ` AND a.organization_id = $1 AND u.ministry_id = $2`;
      params.push(req.user.organization_id, req.user.ministry_id);
    } else if (req.user.role === 'Volunteer') {
      query += ` AND a.user_id = $1`;
      params.push(req.user.id);
    }

    query += ' ORDER BY a.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// POST /api/assignments
router.post('/', requireAuth, async (req, res) => {
  try {
    const { user_id, event_id, status } = req.body;
    
    if (req.user.role === 'Volunteer' && req.user.id !== parseInt(user_id)) {
      return res.status(403).json({ error: 'Forbidden: Can only sign up yourself' });
    }

    const orgId = req.user.role === 'SuperAdmin' ? (req.body.organization_id || 1) : req.user.organization_id;

    const result = await pool.query(
      'INSERT INTO assignments (organization_id, user_id, event_id, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [orgId, user_id, event_id, status || 'Pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// PATCH /api/assignments/:id/status
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const check = await pool.query(`
      SELECT a.organization_id, a.user_id, u.ministry_id 
      FROM assignments a JOIN users u ON a.user_id = u.id 
      WHERE a.id = $1
    `, [id]);

    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const target = check.rows[0];

    if (req.user.role === 'SuperAdmin') {
      // pass
    } else if (req.user.role === 'OrgAdmin') {
      if (target.organization_id !== req.user.organization_id) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role === 'MinistryLeader') {
      if (target.organization_id !== req.user.organization_id || target.ministry_id !== req.user.ministry_id) {
        return res.status(403).json({ error: 'Forbidden: Can only manage your ministry' });
      }
    } else if (req.user.role === 'Volunteer') {
      if (target.user_id !== req.user.id || status !== 'Declined') {
        return res.status(403).json({ error: 'Forbidden: Volunteers can only decline their own assignments' });
      }
    }

    const result = await pool.query(
      'UPDATE assignments SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// DELETE /api/assignments/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const check = await pool.query('SELECT organization_id, user_id FROM assignments WHERE id = $1', [id]);
    
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const target = check.rows[0];

    if (req.user.role === 'SuperAdmin') {
      // pass
    } else if (req.user.role === 'OrgAdmin') {
      if (target.organization_id !== req.user.organization_id) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role === 'Volunteer') {
      if (target.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pool.query('DELETE FROM assignments WHERE id = $1', [id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

module.exports = router;
