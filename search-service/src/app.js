const express = require('express');
const searchRoutes = require('./routes/searchRoutes');

const app = express();
app.use(express.json());
app.use('/', searchRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'search-service' }));

module.exports = app;
