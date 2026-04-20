const express = require('express');
const healthRoutes = require('./routes/healthRoutes');

const app = express();
app.use('/', healthRoutes);

module.exports = app;
