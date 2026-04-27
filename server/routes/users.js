const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, requireAuth, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET /api/users
router.get('/', requireAuth, async (req, res) => {
  try {
    // If volunteer, they shouldn't see all users, but maybe themselves.
    // For MVP demo, OrgAdmin/MinistryLeader sees org users. Volunteer sees only themselves.
    let query = 'SELECT * FROM users WHERE organization_id = $1 ORDER BY created_at DESC';
    let params = [req.user.organization_id];
    
    if (req.user.role === 'SuperAdmin') {
      query = 'SELECT * FROM users ORDER BY created_at DESC';
      params = [];
    } else if (req.user.role === 'Volunteer') {
      query = 'SELECT * FROM users WHERE id = $1';
      params = [req.user.id];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// POST /api/users (Public volunteer sign up)
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, ministry_id, organization_id } = req.body;
    const orgId = organization_id || 1; // Default to org 1 for demo if none provided
    
    const result = await pool.query(
      `INSERT INTO users (organization_id, name, email, phone, role, status, ministry_id) 
       VALUES ($1, $2, $3, $4, 'Volunteer', 'Pending Approval', $5) RETURNING *`,
      [orgId, name, email, phone || null, ministry_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// POST /api/users/import (OrgAdmin CSV Import)
router.post('/import', requireAuth, requireRole(['OrgAdmin', 'SuperAdmin']), async (req, res) => {
  try {
    const { users } = req.body;
    if (!users || !Array.isArray(users)) return res.status(400).json({ error: 'Invalid payload' });

    const orgId = req.user.role === 'SuperAdmin' ? (req.body.organization_id || 1) : req.user.organization_id;
    let imported = 0;

    for (const u of users) {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [u.email]);
      if (existing.rows.length > 0) {
        await pool.query(
          'UPDATE users SET name = $1, phone = $2, external_source = $3, external_id = $4 WHERE email = $5',
          [u.name, u.phone || null, u.external_source || 'CSV', u.external_id || null, u.email]
        );
      } else {
        await pool.query(
          `INSERT INTO users (organization_id, name, email, phone, role, status, external_source, external_id, ministry_id) 
           VALUES ($1, $2, $3, $4, 'Volunteer', 'Active', $5, $6, $7)`,
          [orgId, u.name, u.email, u.phone || null, u.external_source || 'CSV', u.external_id || null, u.ministry_id || null]
        );
      }
      imported++;
    }
    res.json({ message: `Successfully imported/updated ${imported} users.` });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// PUT /api/users/:id
router.put('/:id', requireAuth, requireRole(['OrgAdmin', 'SuperAdmin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, status, ministry_id } = req.body;
    
    if (req.user.role !== 'SuperAdmin') {
      const userCheck = await pool.query('SELECT organization_id FROM users WHERE id = $1', [id]);
      if (userCheck.rows.length === 0 || userCheck.rows[0].organization_id !== req.user.organization_id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, phone = $3, role = $4, status = $5, ministry_id = $6 WHERE id = $7 RETURNING *',
      [name, email, phone, role, status, ministry_id || null, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', requireAuth, requireRole(['OrgAdmin', 'SuperAdmin']), async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'SuperAdmin') {
      const userCheck = await pool.query('SELECT organization_id FROM users WHERE id = $1', [id]);
      if (userCheck.rows.length === 0 || userCheck.rows[0].organization_id !== req.user.organization_id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

module.exports = router;
