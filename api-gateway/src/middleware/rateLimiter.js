/**
 * In-memory sliding window rate limiter.
 *
 * Architecture tactic: Resource Management / Load Shedding — protects
 * the booking system from abuse, bot traffic, and accidental DDoS at
 * the gateway level before requests reach downstream services.
 *
 * Design: Sliding window counter per key (user ID or IP). No external
 * dependencies. For multi-instance deployments, replace with Redis-based
 * rate limiter.
 *
 * Capacity target: 50,000 users, 5,000 concurrent. Rate limits are per-user
 * to prevent a single user from monopolizing resources.
 */

class SlidingWindowRateLimiter {
  /**
   * @param {object} options
   * @param {number} options.windowMs - Sliding window duration in ms (default: 60000).
   * @param {number} options.maxRequests - Max requests per window per key (default: 60).
   * @param {string} [options.message] - Custom error message when rate-limited.
   * @param {number} [options.cleanupIntervalMs] - Interval for pruning expired entries (default: 60000).
   */
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.maxRequests = options.maxRequests || 60;
    this.message = options.message || 'Too many requests. Please try again later.';
    this.cleanupIntervalMs = options.cleanupIntervalMs || 60000;
    this.store = new Map(); // key → [timestamp, timestamp, ...]

    // Periodically clean up expired entries to prevent memory leak
    this._cleanupTimer = setInterval(() => this._cleanup(), this.cleanupIntervalMs);
    if (this._cleanupTimer.unref) this._cleanupTimer.unref();
  }

  /**
   * Express middleware function.
   * @param {Function} [keyGenerator] - Fn(req) → string. Defaults to userId or IP.
   */
  middleware(keyGenerator) {
    const self = this;
    const getKey = keyGenerator || ((req) => {
      return req.user?.userId ? `user:${req.user.userId}` : `ip:${req.ip}`;
    });

    return (req, res, next) => {
      const key = getKey(req);
      const now = Date.now();
      const windowStart = now - self.windowMs;

      let timestamps = self.store.get(key);
      if (!timestamps) {
        timestamps = [];
        self.store.set(key, timestamps);
      }

      // Remove timestamps outside the current window
      while (timestamps.length > 0 && timestamps[0] <= windowStart) {
        timestamps.shift();
      }

      if (timestamps.length >= self.maxRequests) {
        const retryAfterMs = timestamps[0] + self.windowMs - now;
        const retryAfterSec = Math.ceil(retryAfterMs / 1000);
        res.setHeader('Retry-After', retryAfterSec);
        res.setHeader('X-RateLimit-Limit', self.maxRequests);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', new Date(timestamps[0] + self.windowMs).toISOString());
        return res.status(429).json({ message: self.message });
      }

      timestamps.push(now);

      res.setHeader('X-RateLimit-Limit', self.maxRequests);
      res.setHeader('X-RateLimit-Remaining', self.maxRequests - timestamps.length);
      next();
    };
  }

  _cleanup() {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, timestamps] of this.store) {
      while (timestamps.length > 0 && timestamps[0] <= cutoff) {
        timestamps.shift();
      }
      if (timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    this.store.clear();
  }
}

// ── Pre-configured limiters for different endpoint tiers ──

// Global API limiter: 120 requests/minute per user
const globalLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
  message: 'Too many requests. Please try again later.',
});

// Booking write limiter: 10 booking attempts/minute per user
const bookingWriteLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Too many booking attempts. Please wait before trying again.',
});

// Auth limiter: 20 auth attempts/minute per IP (brute-force prevention)
const authLimiter = new SlidingWindowRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: 'Too many authentication attempts. Please try again later.',
});

module.exports = {
  SlidingWindowRateLimiter,
  globalLimiter,
  bookingWriteLimiter,
  authLimiter,
};
