const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, requireAuth, requireRole } = require('../middleware/auth');

router.use(authenticate);

// GET /api/bookings — Scoped by role
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = `
      SELECT
        b.id AS booking_id,
        b.status,
        b.notes,
        b.created_at,
        u.id   AS user_id,
        u.name AS user_name,
        u.email AS user_email,
        s.id   AS service_id,
        s.title AS service_title,
        s.service_date,
        s.start_time,
        s.end_time,
        s.capacity,
        b.organization_id
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN services s ON b.service_id = s.id
      WHERE 1=1
    `;
    let params = [];

    if (req.user.role === 'SuperAdmin') {
      // no filter — sees all orgs
    } else if (['OrgAdmin', 'MinistryLeader'].includes(req.user.role)) {
      query += ` AND b.organization_id = $1`;
      params.push(req.user.organization_id);
    } else {
      // Volunteer / Client: only own bookings, scoped to org
      query += ` AND b.user_id = $1 AND b.organization_id = $2`;
      params.push(req.user.id, req.user.organization_id);
    }

    query += ' ORDER BY b.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// POST /api/bookings — User books a service
router.post('/', requireAuth, async (req, res) => {
  try {
    const { service_id, notes } = req.body;

    if (!service_id) {
      return res.status(400).json({ error: 'service_id is required.' });
    }

    // Validate service belongs to same org
    const svcRes = await pool.query('SELECT * FROM services WHERE id = $1', [service_id]);
    if (svcRes.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found.' });
    }
    const service = svcRes.rows[0];

    if (req.user.role !== 'SuperAdmin' && service.organization_id !== req.user.organization_id) {
      return res.status(403).json({ error: 'Forbidden: Cannot book a service outside your organization.' });
    }

    // Check capacity if defined
    if (service.capacity !== null) {
      const countRes = await pool.query(
        `SELECT COUNT(*) FROM bookings WHERE service_id = $1 AND status != 'Cancelled'`,
        [service_id]
      );
      if (parseInt(countRes.rows[0].count) >= service.capacity) {
        return res.status(409).json({ error: 'This service is fully booked.' });
      }
    }

    const orgId = req.user.role === 'SuperAdmin'
      ? service.organization_id
      : req.user.organization_id;

    const result = await pool.query(
      `INSERT INTO bookings (organization_id, user_id, service_id, status, notes)
       VALUES ($1, $2, $3, 'Pending', $4)
       RETURNING *`,
      [orgId, req.user.id, service_id, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'You already have a booking for this service.' });
    }
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// PATCH /api/bookings/:id/status — Admin confirms/rejects; User cancels their own
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Pending', 'Confirmed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const check = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Booking not found.' });
    const booking = check.rows[0];

    if (req.user.role === 'SuperAdmin') {
      // no restriction
    } else if (['OrgAdmin', 'MinistryLeader'].includes(req.user.role)) {
      if (booking.organization_id !== req.user.organization_id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else {
      // Volunteer/client can only cancel their own booking
      if (booking.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: Can only manage your own bookings.' });
      }
      if (status !== 'Cancelled') {
        return res.status(403).json({ error: 'Forbidden: You can only cancel your own bookings.' });
      }
    }

    const result = await pool.query(
      'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

// DELETE /api/bookings/:id — Admin or the booking owner
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const check = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Booking not found.' });
    const booking = check.rows[0];

    if (req.user.role === 'SuperAdmin') {
      // pass
    } else if (req.user.role === 'OrgAdmin') {
      if (booking.organization_id !== req.user.organization_id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else {
      if (booking.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    await pool.query('DELETE FROM bookings WHERE id = $1', [id]);
    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server Error', details: error.message });
  }
});

module.exports = router;
