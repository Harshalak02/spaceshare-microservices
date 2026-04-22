const axios = require('axios');
const db = require('../models/db');
const ChannelFactory = require('../channels/ChannelFactory');

async function handleEvent(event) {
  console.log(`[Notification] Event received: ${event.type}`);

  if (event.type === 'BOOKING_CONFIRMED') {
    await handleBookingConfirmed(event.payload);
  }
}

async function handleBookingConfirmed(booking) {
  try {
    const spaceId = booking.space_id;
    const customerId = booking.user_id;

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

    // 4. Send notifications
    const channel = ChannelFactory.getChannel();

    // Customer Notification
    const customerSubject = `Booking Confirmed: ${space.title}`;
    const customerBody = `Hello,\n\Your booking for ${space.title} from ${new Date(booking.start_time).toLocaleString()} to ${new Date(booking.end_time).toLocaleString()} has been confirmed!\n\nThank you for using SpaceShare.`;
    await sendAndLogNotification(customerId, 'BOOKING_CONFIRMED', customer.email, customerSubject, customerBody, channel);

    // Host Notification
    const hostSubject = `New Booking: ${space.title}`;
    const hostBody = `Hello,\n\nYou have a new confirmed booking for your space "${space.title}".\nCustomer ID: ${customerId}\nTime: ${new Date(booking.start_time).toLocaleString()} to ${new Date(booking.end_time).toLocaleString()}.\n\nSpaceShare Team`;
    await sendAndLogNotification(hostId, 'BOOKING_CONFIRMED', host.email, hostSubject, hostBody, channel);

  } catch (error) {
    console.error(`❌ [Notification] Error handling BOOKING_CONFIRMED:`, error.message);
  }
}

async function sendAndLogNotification(userId, type, recipient, subject, body, channel) {
  const channelName = process.env.NOTIFICATION_CHANNEL || 'console';
  
  // Attempt to send
  const result = await channel.send(recipient, subject, body);

  // Save to DB
  try {
    await db.query(
      `INSERT INTO notifications (user_id, type, channel, recipient, subject, body, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, type, channelName, recipient, subject, body, result.status]
    );
  } catch (err) {
    console.error(`❌ [Notification] Failed to log notification in DB:`, err.message || err);
  }
}

async function getNotificationsByUser(userId) {
  const result = await db.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows;
}

module.exports = { handleEvent, getNotificationsByUser };
