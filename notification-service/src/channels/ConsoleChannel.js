const BaseChannel = require('./BaseChannel');

/**
 * ConsoleChannel — Observer
 *
 * Enabled when 'console' appears in the NOTIFICATION_CHANNELS env var
 * (or when the legacy NOTIFICATION_CHANNEL=console is set).
 *
 * Subscribes to ALL event types by default.
 */
class ConsoleChannel extends BaseChannel {
  constructor() {
    super();
  }

  /** Subscribe to every event type */
  get subscribedEvents() {
    return ['*'];
  }

  /**
   * Active when 'console' is listed in NOTIFICATION_CHANNELS,
   * or the legacy single-channel env var equals 'console'.
   */
  isEnabled() {
    const channels = (process.env.NOTIFICATION_CHANNELS || process.env.NOTIFICATION_CHANNEL || 'console')
      .toLowerCase()
      .split(',')
      .map((c) => c.trim());
    return channels.includes('console');
  }

  async send(to, subject, body) {
    console.log(`\n================= CONSOLE NOTIFICATION =================`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`--------------------------------------------------------`);
    console.log(`${body}`);
    console.log(`========================================================\n`);
    return { status: 'sent', providerResponse: 'logged to console' };
  }
}

module.exports = ConsoleChannel;
