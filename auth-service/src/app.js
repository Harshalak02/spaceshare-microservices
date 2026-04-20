const express = require('express');
const authRoutes = require('./routes/authRoutes');

const app = express();
app.use(express.json());
app.use('/', authRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth-service' }));

module.exports = app;
