/**
 * Retry utility with exponential backoff and jitter.
 *
 * Architecture tactic: Recovery — bounded retries with exponential backoff
 * prevents thundering-herd on transient failures while bounding total latency.
 */

const DEFAULT_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 200,
  maxDelayMs: 3000,
  jitterMs: 100,
  retryableErrors: null, // null = retry all errors; or provide a predicate fn(error) => boolean
};

/**
 * Execute `fn` with retry logic implementing exponential backoff + jitter.
 *
 * @param {Function} fn - Async function to execute. Receives current attempt number (1-indexed).
 * @param {object} [options] - Retry configuration.
 * @returns {Promise<*>} - Result of `fn` on success.
 */
async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const { maxRetries, baseDelayMs, maxDelayMs, jitterMs, retryableErrors } = config;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (retryableErrors && typeof retryableErrors === 'function' && !retryableErrors(error)) {
        throw error; // Non-retryable error — fail immediately
      }

      if (attempt === maxRetries) {
        break; // Exhausted retries
      }

      // Exponential backoff: delay = min(baseDelay * 2^(attempt-1) + jitter, maxDelay)
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * jitterMs;
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

module.exports = { withRetry };
