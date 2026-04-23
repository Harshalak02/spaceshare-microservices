const express = require('express');
const listingRoutes = require('./routes/listingRoutes');

const app = express();
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '20mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.REQUEST_BODY_LIMIT || '20mb' }));
app.use('/', listingRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'listing-service' }));

module.exports = app;
