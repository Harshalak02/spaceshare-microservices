const db = require('../models/db');
const redis = require('../models/redis');

async function createBooking(data) {
  const { space_id, user_id, start_time, end_time } = data;

  // Cleanup old pending bookings (older than 2 minutes) for this space
  await db.query(
    `UPDATE bookings 
     SET status = 'cancelled' 
     WHERE space_id = $1 AND status = 'pending' AND created_at <= NOW() - INTERVAL '2 minutes'`,
    [space_id]
  );

  // Prevent overlapping bookings.
  const overlap = await db.query(
    `SELECT id FROM bookings
     WHERE space_id = $1
     AND NOT ($3 <= start_time OR $2 >= end_time)
     AND (status = 'confirmed' OR (status = 'pending' AND created_at > NOW() - INTERVAL '2 minutes'))`,
    [space_id, start_time, end_time]
  );

  if (overlap.rows.length > 0) {
    throw new Error('Space is already booked or locked for payment in this time slot');
  }

  const result = await db.query(
    `INSERT INTO bookings (space_id, user_id, start_time, end_time, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [space_id, user_id, start_time, end_time]
  );

  const booking = result.rows[0];

  // We do not publish BOOKING_CONFIRMED yet because it is pending.
  // The payment service will handle the confirmation flow.

  return booking;
}

async function updateBookingStatus(bookingId, status) {
  const result = await db.query(
    `UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *`,
    [status, bookingId]
  );
  
  const booking = result.rows[0];
  if (booking && status === 'confirmed') {
    await redis.publish('events', JSON.stringify({
      type: 'BOOKING_CONFIRMED',
      timestamp: new Date().toISOString(),
      payload: booking
    }));
  }
  return booking;
}

async function getBookingsByUser(userId) {
  const result = await db.query('SELECT * FROM bookings WHERE user_id=$1 ORDER BY start_time DESC', [userId]);
  return result.rows;
}

async function cancelBooking(bookingId, userId) {
  // Only cancel if it's currently pending
  const result = await db.query(
    `UPDATE bookings SET status = 'cancelled' 
     WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING *`,
    [bookingId, userId]
  );
  return result.rows[0];
}

module.exports = { createBooking, updateBookingStatus, getBookingsByUser, cancelBooking };
