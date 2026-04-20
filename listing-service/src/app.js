const express = require('express');
const listingRoutes = require('./routes/listingRoutes');

const app = express();
app.use(express.json());
app.use('/', listingRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'listing-service' }));

module.exports = app;
