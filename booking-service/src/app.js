const express = require('express');
const bookingRoutes = require('./routes/bookingRoutes');

const app = express();
app.use(express.json());
app.use('/', bookingRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'booking-service' }));

module.exports = app;
