const express = require('express');
const routes = require('./routes/subscriptionRoutes');

const app = express();
app.use(express.json());
app.use('/', routes);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'subscription-service' }));

module.exports = app;
