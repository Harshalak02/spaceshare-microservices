const express = require('express');
const healthRoutes = require('./routes/healthRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
app.use(express.json());
app.use('/', healthRoutes);
app.use('/', notificationRoutes);

module.exports = app;
