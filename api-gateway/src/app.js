const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const gatewayRoutes = require('./routes/gatewayRoutes');
const { globalLimiter } = require('./middleware/rateLimiter');

const app = express();
app.use(cors());
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '20mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.REQUEST_BODY_LIMIT || '20mb' }));

// ──────────────────────────────────────────────────────────
// Fix 7: Correlation ID — Generate a unique request ID at
// the gateway and propagate it to all downstream services.
// Enables end-to-end distributed tracing.
// ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// ──────────────────────────────────────────────────────────
// Fix 6: Global rate limiter — 120 requests/min per user.
// ──────────────────────────────────────────────────────────
app.use('/api', globalLimiter.middleware());

app.use('/api', gatewayRoutes);

// ──────────────────────────────────────────────────────────
// Fix 9: Aggregated health check — queries downstream services
// and reports their status alongside the gateway's own status.
// ──────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const services = {
    auth: process.env.AUTH_SERVICE_URL,
    listing: process.env.LISTING_SERVICE_URL,
    search: process.env.SEARCH_SERVICE_URL,
    booking: process.env.BOOKING_SERVICE_URL,
    payment: process.env.PAYMENT_SERVICE_URL,
    notification: process.env.NOTIFICATION_SERVICE_URL,
    subscription: process.env.SUBSCRIPTION_SERVICE_URL,
    analytics: process.env.ANALYTICS_SERVICE_URL,
  };

  const HEALTH_TIMEOUT_MS = 3000;
  const checks = {};
  let allHealthy = true;

  await Promise.all(
    Object.entries(services).map(async ([name, url]) => {
      if (!url) {
        checks[name] = { status: 'unconfigured' };
        return;
      }
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
        const response = await fetch(`${url}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        checks[name] = { status: response.ok ? 'healthy' : 'unhealthy', httpStatus: response.status };
        if (!response.ok) allHealthy = false;
      } catch (error) {
        checks[name] = { status: 'unreachable', error: error.message };
        allHealthy = false;
      }
    })
  );

  res.status(allHealthy ? 200 : 207).json({
    status: allHealthy ? 'healthy' : 'degraded',
    service: 'api-gateway',
    downstream: checks,
  });
});

module.exports = app;
