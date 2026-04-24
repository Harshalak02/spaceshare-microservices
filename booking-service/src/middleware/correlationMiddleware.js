/**
 * Correlation ID middleware for distributed request tracing.
 *
 * Architecture tactic: Observability — every request gets a unique correlation
 * ID that is propagated to all downstream service calls, enabling end-to-end
 * tracing without external tracing infrastructure.
 *
 * If the incoming request already contains an `x-correlation-id` header
 * (e.g., set by the API gateway), it is reused. Otherwise a new UUID is generated.
 */

const crypto = require('crypto');

function generateCorrelationId() {
  return crypto.randomUUID();
}

function correlationMiddleware(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}

module.exports = { correlationMiddleware, generateCorrelationId };
