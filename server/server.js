require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// Use port 5001 to avoid macOS AirPlay Receiver port 5000 conflicts (which cause 403 Forbidden)
const port = process.env.PORT || 5001;

// Middleware
// Explicitly allow localhost:5173 for the frontend demo
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());

// Routes
const authRoute = require('./routes/auth');
const usersRoute = require('./routes/users');
const ministriesRoute = require('./routes/ministries');
const eventsRoute = require('./routes/events');
const assignmentsRoute = require('./routes/assignments');
const organizationsRoute = require('./routes/organizations');
const servicesRoute = require('./routes/services');
const bookingsRoute = require('./routes/bookings');

app.use('/api/auth', authRoute);
app.use('/api/users', usersRoute);
app.use('/api/ministries', ministriesRoute);
app.use('/api/events', eventsRoute);
app.use('/api/assignments', assignmentsRoute);
app.use('/api/organizations', organizationsRoute);
app.use('/api/services', servicesRoute);
app.use('/api/bookings', bookingsRoute);

// Root test route
app.get('/', (req, res) => {
  res.send('ServeFlow API is running');
});

// Health route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
