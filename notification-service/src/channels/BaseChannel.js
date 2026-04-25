/**
 * BaseChannel — Abstract Observer
 *
 * Every concrete channel (Email, Console, …) extends this class.
 * The NotificationEventBus (Subject) calls `notify(eventType, context)`
 * on each registered observer whenever an event is published.
 *
 * Concrete channels should override:
 *   - get subscribedEvents()  → string[]  list of event types to listen for
 *   - isEnabled()             → boolean   whether the channel is active
 *   - send(to, subject, body) → Promise   deliver the actual notification
 */
class BaseChannel {
  /**
   * List of event types this channel subscribes to.
   * Override in subclasses to restrict the channel to specific events.
   * Return ['*'] to subscribe to all events.
   * @returns {string[]}
   */
  get subscribedEvents() {
    return ['*'];
  }

  /**
   * Whether this channel is currently active.
   * Override in subclasses to read env-vars, feature flags, etc.
   * @returns {boolean}
   */
  isEnabled() {
    return true;
  }

  /**
   * Called by the NotificationEventBus when a subscribed event fires.
   * The default implementation delegates to send(); override if needed.
   *
   * @param {string} eventType  - e.g. 'BOOKING_CONFIRMED'
   * @param {{ to: string, subject: string, body: string }} context
   * @returns {Promise<{ status: string, providerResponse: string }>}
   */
  async notify(eventType, { to, subject, body }) {
    return this.send(to, subject, body);
  }

  /**
   * Deliver the notification via this channel.
   * Must be implemented by every concrete channel.
   *
   * @param {string} to
   * @param {string} subject
   * @param {string} body
   * @returns {Promise<{ status: string, providerResponse: string }>}
   */
  async send(to, subject, body) {
    throw new Error("Method 'send' must be implemented by subclass.");
  }
}

module.exports = BaseChannel;