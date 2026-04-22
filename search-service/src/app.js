const express = require('express');
const searchRoutes = require('./routes/searchRoutes');
const { startListingSyncSubscriber } = require('./services/listingSyncService');

const app = express();
app.use((req, res, next) => {
  console.log(`[Search Service] Received request: ${req.method} ${req.url}`);
  next();
});
app.use(express.json());
app.use('/', searchRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'search-service' }));

startListingSyncSubscriber().catch((err) => {
  console.error('❌ [search-service] Failed to start listing sync subscriber:', err.message);
});

module.exports = app;
