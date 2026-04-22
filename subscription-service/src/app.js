const express = require('express');
const cors = require('cors'); // ✅ ADD THIS
const routes = require('./routes/subscriptionRoutes');

const app = express();

// ✅ ADD CORS HERE (TOP, BEFORE ROUTES)
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use('/', routes);

app.get('/health', (req, res) => 
  res.json({ status: 'ok', service: 'subscription-service' })
);

module.exports = app;