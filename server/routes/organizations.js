const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const bcrypt = require('bcryptjs');
const { authenticate, requireAuth, requireRole } = require('../middleware/auth');

router.use(authenticate);
router.use(requireAuth);
router.use(requireRole(['SuperAdmin']));

// GET /api/organizations
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM organizations ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// POST /api/organizations
router.post('/', async (req, res) => {
  try {
    const { name, slug, industry, status } = req.body;
    const result = await pool.query(
      `INSERT INTO organizations (name, slug, industry, status) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, slug, industry || null, status || 'Active']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Organization slug must be unique.' });
    }
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// PUT /api/organizations/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, industry, status } = req.body;
    const result = await pool.query(
      `UPDATE organizations SET name = $1, slug = $2, industry = $3, status = $4 
       WHERE id = $5 RETURNING *`,
      [name, slug, industry || null, status || 'Active', id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Organization not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// DELETE /api/organizations/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM organizations WHERE id = $1', [id]);
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// GET /api/organizations/:id/admins
router.get('/:id/admins', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, name, email, phone, role, status, must_change_password, created_at
       FROM users WHERE organization_id = $1 AND role = 'OrgAdmin' ORDER BY created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// POST /api/organizations/:id/admins
router.post('/:id/admins', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    // Block admin creation in the system organization
    const orgRes = await pool.query('SELECT slug FROM organizations WHERE id = $1', [id]);
    if (orgRes.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found.' });
    }
    if (orgRes.rows[0].slug === 'system') {
      return res.status(403).json({ error: 'Cannot create admins inside the System Organization.' });
    }

    // Check if email exists
    const emailRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailRes.rows.length > 0) {
      return res.status(400).json({ error: 'Email already in use.' });
    }

    // Hash the temporary password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (organization_id, name, email, phone, password_hash, role, status, must_change_password) 
       VALUES ($1, $2, $3, $4, $5, 'OrgAdmin', 'Active', true) RETURNING id, name, email, phone, role, status, must_change_password`,
      [id, name, email, phone || null, password_hash]
    );

    res.status(201).json({ message: 'OrgAdmin created successfully.', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

module.exports = router;
