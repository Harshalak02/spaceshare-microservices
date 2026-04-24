/**
 * Lightweight Circuit Breaker implementation (no external dependencies).
 *
 * Architecture tactic: Fault Isolation — prevents cascading failures by
 * fast-failing requests when a downstream dependency is consistently failing.
 *
 * States:
 *   CLOSED    → Normal operation. Track failures. If error rate exceeds
 *               threshold within a rolling window, trip to OPEN.
 *   OPEN      → Fast-fail all requests. After a cooldown period, transition
 *               to HALF_OPEN.
 *   HALF_OPEN → Allow a limited number of probe requests. If they succeed,
 *               return to CLOSED. If they fail, go back to OPEN.
 */

const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

class CircuitBreaker {
  /**
   * @param {string} name - Identifier for this breaker (for logging).
   * @param {object} [options]
   * @param {number} [options.failureThreshold=5] - Failures to trip the breaker.
   * @param {number} [options.resetTimeoutMs=30000] - Cooldown before HALF_OPEN.
   * @param {number} [options.halfOpenMaxAttempts=2] - Probe attempts in HALF_OPEN.
   * @param {number} [options.rollingWindowMs=60000] - Window for counting failures.
   */
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts || 2;
    this.rollingWindowMs = options.rollingWindowMs || 60000;

    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
    this.failureTimestamps = [];
  }

  /**
   * Execute a function through the circuit breaker.
   *
   * @param {Function} fn - Async function to execute.
   * @returns {Promise<*>} - Result of fn on success.
   * @throws {Error} - Circuit breaker open error, or the underlying fn error.
   */
  async execute(fn) {
    if (this.state === STATES.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this._transitionTo(STATES.HALF_OPEN);
      } else {
        throw new Error(`Circuit breaker [${this.name}] is OPEN — request rejected`);
      }
    }

    if (this.state === STATES.HALF_OPEN && this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
      throw new Error(`Circuit breaker [${this.name}] is HALF_OPEN — max probe attempts reached`);
    }

    try {
      if (this.state === STATES.HALF_OPEN) {
        this.halfOpenAttempts++;
      }

      const result = await fn();

      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure();
      throw error;
    }
  }

  _onSuccess() {
    if (this.state === STATES.HALF_OPEN) {
      console.log(`✅ [circuit-breaker] [${this.name}] Probe succeeded — closing circuit`);
      this._transitionTo(STATES.CLOSED);
    }
    // In CLOSED state, success is normal — no action needed.
  }

  _onFailure() {
    const now = Date.now();
    this.lastFailureTime = now;

    if (this.state === STATES.HALF_OPEN) {
      console.warn(`⚠️ [circuit-breaker] [${this.name}] Probe failed — reopening circuit`);
      this._transitionTo(STATES.OPEN);
      return;
    }

    // CLOSED state: track failures in rolling window
    this.failureTimestamps.push(now);
    this._pruneOldFailures(now);
    this.failureCount = this.failureTimestamps.length;

    if (this.failureCount >= this.failureThreshold) {
      console.error(
        `🔴 [circuit-breaker] [${this.name}] Failure threshold reached (${this.failureCount}/${this.failureThreshold}) — opening circuit`
      );
      this._transitionTo(STATES.OPEN);
    }
  }

  _pruneOldFailures(now) {
    const cutoff = now - this.rollingWindowMs;
    this.failureTimestamps = this.failureTimestamps.filter((ts) => ts > cutoff);
  }

  _transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;

    if (newState === STATES.CLOSED) {
      this.failureCount = 0;
      this.failureTimestamps = [];
      this.halfOpenAttempts = 0;
    } else if (newState === STATES.HALF_OPEN) {
      this.halfOpenAttempts = 0;
    }

    if (oldState !== newState) {
      console.log(`🔄 [circuit-breaker] [${this.name}] ${oldState} → ${newState}`);
    }
  }

  /** Get current state for health checks and monitoring. */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
    };
  }
}

module.exports = { CircuitBreaker, STATES };
