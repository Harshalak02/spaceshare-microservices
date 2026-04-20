const express = require('express');
const gatewayRoutes = require('./routes/gatewayRoutes');

const app = express();
app.use(express.json());
app.use('/api', gatewayRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

module.exports = app;
