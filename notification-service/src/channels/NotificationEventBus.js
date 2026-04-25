const EmailChannel = require('./EmailChannel');
const ConsoleChannel = require('./ConsoleChannel');

/**
 * NotificationEventBus — Subject (Observable)
 *
 * Implements the Observer pattern for the notification service.
 *
 * Channels (Observers) are registered once at startup. When an event
 * is published, the bus fans-out to every enabled channel that has
 * subscribed to that event type.
 *
 * Usage:
 *   const bus = NotificationEventBus.getInstance();
 *   // publish to all enabled, subscribed channels:
 *   const results = await bus.publish('BOOKING_CONFIRMED', { to, subject, body });
 *
 * To add a new channel, import it and push a new instance to the
 * `allChannels` array inside _buildChannels().
 */
class NotificationEventBus {
  constructor() {
    /** @type {import('./BaseChannel')[]} */
    this._channels = this._buildChannels();
  }

  // ─── Singleton ────────────────────────────────────────────────────────────

  static getInstance() {
    if (!NotificationEventBus._instance) {
      NotificationEventBus._instance = new NotificationEventBus();
    }
    return NotificationEventBus._instance;
  }

  // ─── Channel registry ─────────────────────────────────────────────────────

  /**
   * Build the full list of possible channels.
   * Each channel decides for itself (via isEnabled()) whether it participates.
   * @returns {import('./BaseChannel')[]}
   */
  _buildChannels() {
    return [
      new EmailChannel(),
      new ConsoleChannel(),
    ];
  }

  /**
   * Return all channels that are enabled AND have subscribed to eventType.
   * @param {string} eventType
   * @returns {import('./BaseChannel')[]}
   */
  _getActiveChannels(eventType) {
    return this._channels.filter((ch) => {
      if (!ch.isEnabled()) return false;
      const subs = ch.subscribedEvents;
      return subs.includes('*') || subs.includes(eventType);
    });
  }

  // ─── Observer interface ───────────────────────────────────────────────────

  /**
   * Register an additional channel observer at runtime.
   * @param {import('./BaseChannel')} channel
   */
  subscribe(channel) {
    this._channels.push(channel);
  }

  /**
   * Remove a previously registered channel observer.
   * @param {import('./BaseChannel')} channel
   */
  unsubscribe(channel) {
    this._channels = this._channels.filter((ch) => ch !== channel);
  }

  // ─── Publish ──────────────────────────────────────────────────────────────

  /**
   * Publish a notification event to all active, subscribed channels.
   *
   * @param {string} eventType          - e.g. 'BOOKING_CONFIRMED'
   * @param {{ to: string, subject: string, body: string }} context
   * @returns {Promise<Array<{ channel: string, status: string, providerResponse: string }>>}
   */
  async publish(eventType, context) {
    const activeChannels = this._getActiveChannels(eventType);

    if (activeChannels.length === 0) {
      console.warn(`⚠️  [EventBus] No active channels for event "${eventType}". Check NOTIFICATION_CHANNELS env var.`);
      return [];
    }

    console.log(`📢 [EventBus] Publishing "${eventType}" to ${activeChannels.length} channel(s): ${activeChannels.map((c) => c.constructor.name).join(', ')}`);

    // Fan-out: notify all channels concurrently
    const results = await Promise.all(
      activeChannels.map(async (ch) => {
        const result = await ch.notify(eventType, context);
        return {
          channel: ch.constructor.name,
          ...result,
        };
      })
    );

    return results;
  }
}

/** @type {NotificationEventBus | undefined} */
NotificationEventBus._instance = undefined;

module.exports = NotificationEventBus;
