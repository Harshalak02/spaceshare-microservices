const axios = require('axios');
const db = require('../models/db');
const NotificationEventBus = require('../channels/NotificationEventBus');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toUtcIsoString(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function toWindowDisplay(booking) {
  const startValue = booking.start_time || booking.start_slot_utc;
  const endValue = booking.end_time || booking.end_slot_utc;

  const startUtc = toUtcIsoString(startValue);
  const endUtc = toUtcIsoString(endValue);

  if (!startUtc || !endUtc) {
    return { startText: 'N/A', endText: 'N/A' };
  }

  const formatIST = (isoString) => {
    return new Date(isoString).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }).toLowerCase();
  };

  return {
    startText: formatIST(startUtc),
    endText: formatIST(endUtc)
  };
}

// ─── Event dispatcher ─────────────────────────────────────────────────────────

/**
 * Entry point called by the message-queue consumer.
 * Routes each incoming event to the appropriate handler.
 */
async function handleEvent(event) {
  console.log(`[Notification] Event received: ${event.type}`);

  if (event.type === 'BOOKING_CONFIRMED') {
    await handleBookingConfirmed(event.payload);
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleBookingConfirmed(booking) {
  try {
    const spaceId = booking.space_id;
    const customerId = booking.user_id;
    const { startText, endText } = toWindowDisplay(booking);

    // 1. Fetch space details (to get owner_id and space title)
    const listingRes = await axios.get(`${process.env.LISTING_SERVICE_URL}/spaces/${spaceId}`);
    const space = listingRes.data;
    const hostId = space.owner_id;

    // 2. Fetch customer details
    const customerRes = await axios.get(`${process.env.AUTH_SERVICE_URL}/users/${customerId}`);
    const customer = customerRes.data;

    // 3. Fetch host details
    const hostRes = await axios.get(`${process.env.AUTH_SERVICE_URL}/users/${hostId}`);
    const host = hostRes.data;

    // 4. Publish notifications via the Observer-based EventBus.
    //    The bus fans-out to ALL enabled channels that subscribe to this event.

    // Customer Notification
    const customerSubject = `Booking Confirmed: ${space.title}`;
    const customerBody = `Hello,\n\nYour booking for ${space.title} from ${startText} to ${endText} has been confirmed!\n\nThank you for using SpaceShare.`;
    await publishAndLog(customerId, 'BOOKING_CONFIRMED', customer.email, customerSubject, customerBody);

    // Host Notification
    const hostSubject = `New Booking: ${space.title}`;
    const hostBody = `Hello,\n\nYou have a new confirmed booking for your space "${space.title}".\nCustomer ID: ${customerId}\nTime: ${startText} to ${endText}.\n\nSpaceShare Team\n\nDelivered by MailerSend`;
    await publishAndLog(hostId, 'BOOKING_CONFIRMED', host.email, hostSubject, hostBody);

  } catch (error) {
    const failedUrl = error.config ? error.config.url : 'Unknown URL';
    console.error(`❌ [Notification] Error handling BOOKING_CONFIRMED at ${failedUrl}:`, error.message);
  }
}

// ─── Core publish + DB log ─────────────────────────────────────────────────────

/**
 * Publishes a notification event to the NotificationEventBus and persists
 * one DB log row per channel result.
 *
 * @param {string | number} userId
 * @param {string}          eventType  - e.g. 'BOOKING_CONFIRMED'
 * @param {string}          recipient  - email address / phone / etc.
 * @param {string}          subject
 * @param {string}          body
 */
async function publishAndLog(userId, eventType, recipient, subject, body) {
  const bus = NotificationEventBus.getInstance();

  // Fan-out: returns one result object per channel that handled this event
  const results = await bus.publish(eventType, { to: recipient, subject, body });

  // Persist a log row for every channel that attempted delivery
  for (const result of results) {
    try {
      await db.query(
        `INSERT INTO notifications (user_id, type, channel, recipient, subject, body, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, eventType, result.channel, recipient, subject, body, result.status]
      );
    } catch (err) {
      console.error(`❌ [Notification] Failed to log notification in DB for channel ${result.channel}:`, err.message || err);
    }
  }
}

// ─── Query helpers ─────────────────────────────────────────────────────────────

async function getNotificationsByUser(userId) {
  const result = await db.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows;
}

module.exports = { handleEvent, getNotificationsByUser };
