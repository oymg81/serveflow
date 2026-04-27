const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, requireAuth, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET /api/services — All authenticated users see their org's services
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = `SELECT * FROM services`;
    let params = [];

    if (req.user.role === 'SuperAdmin') {
      // SuperAdmin sees all services across all orgs
      query += ` ORDER BY service_date ASC, start_time ASC`;
    } else {
      // Everyone else is scoped to their own organization
      query += ` WHERE organization_id = $1 AND status = 'Active' ORDER BY service_date ASC, start_time ASC`;
      params = [req.user.organization_id];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// POST /api/services — OrgAdmin (or SuperAdmin) creates a service
router.post('/', requireAuth, requireRole(['OrgAdmin', 'SuperAdmin']), async (req, res) => {
  try {
    const { title, description, service_date, start_time, end_time, capacity } = req.body;

    if (!title || !service_date || !start_time || !end_time) {
      return res.status(400).json({ error: 'title, service_date, start_time, and end_time are required.' });
    }

    const orgId = req.user.role === 'SuperAdmin'
      ? (req.body.organization_id || req.user.organization_id)
      : req.user.organization_id;

    const result = await pool.query(
      `INSERT INTO services (organization_id, title, description, service_date, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [orgId, title, description || null, service_date, start_time, end_time, capacity || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// PUT /api/services/:id — OrgAdmin updates a service
router.put('/:id', requireAuth, requireRole(['OrgAdmin', 'SuperAdmin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, service_date, start_time, end_time, capacity, status } = req.body;

    // Enforce org isolation
    if (req.user.role !== 'SuperAdmin') {
      const check = await pool.query('SELECT organization_id FROM services WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].organization_id !== req.user.organization_id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const result = await pool.query(
      `UPDATE services SET title=$1, description=$2, service_date=$3, start_time=$4, end_time=$5, capacity=$6, status=$7
       WHERE id=$8 RETURNING *`,
      [title, description || null, service_date, start_time, end_time, capacity || null, status || 'Active', id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// DELETE /api/services/:id — OrgAdmin deletes a service
router.delete('/:id', requireAuth, requireRole(['OrgAdmin', 'SuperAdmin']), async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'SuperAdmin') {
      const check = await pool.query('SELECT organization_id FROM services WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].organization_id !== req.user.organization_id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    await pool.query('DELETE FROM services WHERE id = $1', [id]);
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

module.exports = router;
