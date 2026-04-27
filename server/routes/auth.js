const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate, requireAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_local_dev';

// GET /api/auth/orgs — Public: lists orgs available for self-registration (excludes system)
router.get('/orgs', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, slug, industry FROM organizations WHERE slug != 'system' AND status = 'Active' ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, slug } = req.body;
    
    // Find organization by slug
    const orgRes = await pool.query('SELECT id FROM organizations WHERE slug = $1', [slug]);
    if (orgRes.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found. Please provide a valid slug.' });
    }
    const organization_id = orgRes.rows[0].id;

    // Check if email exists
    const emailRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailRes.rows.length > 0) {
      return res.status(400).json({ error: 'Email already in use.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert user (default Volunteer, Active so they can log in immediately)
    const result = await pool.query(
      `INSERT INTO users (organization_id, name, email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, 'Volunteer', 'Active') RETURNING id, name, email, role, status`,
      [organization_id, name, email, phone || null, password_hash]
    );

    res.status(201).json({ message: 'Registration successful! You can now log in.', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1 OR phone = $1', [emailOrPhone]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = userRes.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'Pending Approval') {
      return res.status(403).json({ error: 'Your account is pending approval.' });
    }
    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Your account is inactive.' });
    }

    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    delete user.password_hash;

    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, requireAuth, (req, res) => {
  const user = { ...req.user };
  delete user.password_hash;
  res.json(user);
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Verify current password
    const userRes = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const isMatch = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isMatch) return res.status(400).json({ error: 'Incorrect current password' });
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);
    
    // Update DB
    await pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
      [password_hash, req.user.id]
    );
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

module.exports = router;
