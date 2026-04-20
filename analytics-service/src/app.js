const express = require('express');
const routes = require('./routes/healthRoutes');

const app = express();
app.use('/', routes);

module.exports = app;
