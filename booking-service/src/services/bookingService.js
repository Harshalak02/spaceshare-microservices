const axios = require('axios');
const db = require('../models/db');
const redis = require('../models/redis');

async function createBooking(data) {
  const { space_id, user_id, start_time, end_time } = data;

  // Verify that space exists from listing service.
  await axios.get(`${process.env.LISTING_SERVICE_URL}/spaces/${space_id}`);

  // Prevent overlapping bookings.
  const overlap = await db.query(
    `SELECT id FROM bookings
     WHERE space_id = $1
     AND NOT ($3 <= start_time OR $2 >= end_time)`,
    [space_id, start_time, end_time]
  );

  if (overlap.rows.length > 0) {
    throw new Error('Space is already booked for this time slot');
  }

  const result = await db.query(
    `INSERT INTO bookings (space_id, user_id, start_time, end_time)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [space_id, user_id, start_time, end_time]
  );

  const booking = result.rows[0];

  await redis.publish('events', JSON.stringify({
    type: 'BOOKING_CONFIRMED',
    timestamp: new Date().toISOString(),
    payload: booking
  }));

  return booking;
}

async function getBookingsByUser(userId) {
  const result = await db.query('SELECT * FROM bookings WHERE user_id=$1 ORDER BY start_time DESC', [userId]);
  return result.rows;
}

module.exports = { createBooking, getBookingsByUser };
