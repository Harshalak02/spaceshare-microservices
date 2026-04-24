const express = require('express');
const bookingRoutes = require('./routes/bookingRoutes');
const { correlationMiddleware } = require('./middleware/correlationMiddleware');

const app = express();

// Fix 7: Correlation ID middleware — generates or propagates a unique
// request ID for distributed tracing across all services.
app.use(correlationMiddleware);

app.use((req, res, next) => {
  console.log(`[Booking Service] [${req.correlationId}] ${req.method} ${req.url}`);
  next();
});
app.use(express.json());
app.use('/', bookingRoutes);

// Health endpoint includes circuit breaker status for monitoring
app.get('/health', (req, res) => {
  const bookingService = require('./services/bookingService');
  res.json({
    status: 'ok',
    service: 'booking-service',
    circuitBreaker: bookingService.getCircuitBreakerStatus(),
  });
});

module.exports = app;
