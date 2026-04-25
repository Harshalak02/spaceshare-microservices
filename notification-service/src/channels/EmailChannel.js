const nodemailer = require('nodemailer');
const BaseChannel = require('./BaseChannel');

/**
 * EmailChannel — Observer
 *
 * Enabled when 'email' appears in the NOTIFICATION_CHANNELS env var
 * (or when the legacy NOTIFICATION_CHANNEL=email is set).
 *
 * Subscribes to ALL event types by default.
 */
class EmailChannel extends BaseChannel {
  constructor() {
    super();
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, // true for 465, false for other ports (587)
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    this.fromEmail = process.env.EMAIL_FROM || 'notifications@example.com';
  }

  /** Subscribe to every event type */
  get subscribedEvents() {
    return ['*'];
  }

  /**
   * Active when 'email' is listed in NOTIFICATION_CHANNELS,
   * or the legacy single-channel env var equals 'email'.
   */
  isEnabled() {
    const channels = (process.env.NOTIFICATION_CHANNELS || process.env.NOTIFICATION_CHANNEL || 'console')
      .toLowerCase()
      .split(',')
      .map((c) => c.trim());
    return channels.includes('email');
  }

  async send(to, subject, body) {
    try {
      const info = await this.transporter.sendMail({
        from: `"SpaceShare" <${this.fromEmail}>`,
        to: to,
        subject: subject,
        text: body,
      });

      console.log(`✅ [EmailChannel] Message sent: ${info.messageId} to ${to}`);
      return { status: 'sent', providerResponse: info.messageId };
    } catch (error) {
      console.error(`❌ [EmailChannel] Error sending to ${to}:`, error.message);
      return { status: 'failed', providerResponse: error.message };
    }
  }
}

module.exports = EmailChannel;
