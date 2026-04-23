const db = require('../models/db');
const redis = require('../models/redis');
const http = require('http');
const { processPayment } = require('./paymentService');
const { parseUtcInput, toUtcIsoString } = require('../utils/dateTime');

const LISTING_SERVICE_URL = process.env.LISTING_SERVICE_URL || 'http://localhost:4002';
const INTERNAL_HTTP_TIMEOUT_MS = Number(process.env.INTERNAL_HTTP_TIMEOUT_MS || 5000);
const BOOKING_TIMESTAMP_FIELDS = [
  'start_time',
  'end_time',
  'start_slot_utc',
  'end_slot_utc',
  'created_at',
  'cancelled_at',
  'completed_at'
];

function toDecimal(value) {
  return Number(Number(value).toFixed(2));
}

function isSlotBoundaryAligned(date) {
  // Listing slots are generated in listing-local hours, which may map to non-zero UTC minutes
  // (for example +05:30 zones). We only require exact minute boundaries in UTC.
  return date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
}

function buildSlotSequence(startDate, slotCount) {
  const slots = [];
  for (let index = 0; index < slotCount; index += 1) {
    const slotStart = new Date(startDate.getTime() + index * 60 * 60 * 1000);
    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
    slots.push({ slotStart, slotEnd });
  }
  return slots;
}

function normalizeBookingRow(row) {
  if (!row) return row;

  const normalized = { ...row };
  for (const key of BOOKING_TIMESTAMP_FIELDS) {
    normalized[key] = toUtcIsoString(normalized[key]);
  }

  return normalized;
}

async function publishBookingEvent(type, payload) {
  try {
    await redis.publish('events', JSON.stringify({
      type,
      timestamp: new Date().toISOString(),
      payload
    }));
  } catch (error) {
    console.error(`❌ [booking-service] Failed to publish ${type}:`, error.message);
  }
}

async function httpGetJson(requestOptions, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = http.get(requestOptions, (response) => {
      let raw = '';
      response.on('data', (chunk) => {
        raw += chunk;
      });

      response.on('end', () => {
        if (response.statusCode === 404) {
          return reject(new Error('Listing not found'));
        }
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          return reject(new Error('Listing service unavailable'));
        }

        try {
          const parsed = raw ? JSON.parse(raw) : {};
          return resolve(parsed);
        } catch (error) {
          return reject(new Error('Listing service unavailable'));
        }
      });
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`timeout of ${timeoutMs}ms exceeded`));
    });

    request.on('error', () => {
      reject(new Error('Listing service unavailable'));
    });
  });
}

async function fetchListingSnapshot(spaceId) {
  const endpoint = new URL(`/spaces/${spaceId}`, LISTING_SERVICE_URL);
  const requestOptions = {
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    port: endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80),
    path: `${endpoint.pathname}${endpoint.search}`
  };

  return httpGetJson(requestOptions, INTERNAL_HTTP_TIMEOUT_MS);
}

async function createBooking(data) {
  const {
    space_id,
    user_id,
    start_slot_utc,
    slot_count,
    guest_count = 1,
    idempotency_key
  } = data;

  if (!space_id || !user_id || !start_slot_utc) {
    throw new Error('space_id, user_id and start_slot_utc are required');
  }

  const slotCount = Number(slot_count);
  if (!Number.isInteger(slotCount) || slotCount < 1) {
    throw new Error('slot_count must be a positive integer');
  }

  const guestCount = Number(guest_count || 1);
  if (!Number.isInteger(guestCount) || guestCount < 1) {
    throw new Error('guest_count must be a positive integer');
  }

  const start = parseUtcInput(start_slot_utc, 'start_slot_utc');
  if (!isSlotBoundaryAligned(start)) {
    throw new Error('start_slot_utc must align to exact minute boundaries');
  }

  const end = new Date(start.getTime() + slotCount * 60 * 60 * 1000);
  const listing = await fetchListingSnapshot(space_id);

  const listingCapacity = Number(listing.capacity || 0);
  if (listingCapacity > 0 && guestCount > listingCapacity) {
    throw new Error('Guest count exceeds listing capacity');
  }

  const pricePerHour = Number(listing.price_per_hour || 0);
  if (!Number.isFinite(pricePerHour) || pricePerHour <= 0) {
    throw new Error('Listing price is invalid');
  }

  const subtotal = toDecimal(pricePerHour * slotCount);
  const platformFee = 0;
  const taxAmount = 0;
  const totalAmount = toDecimal(subtotal + platformFee + taxAmount);

  const paymentSuccess = await processPayment({
    user_id,
    space_id,
    slot_count: slotCount,
    start_slot_utc: start.toISOString(),
    amount: totalAmount,
    currency: 'inr',
    metadata: {
      user_id,
      space_id,
      slot_count: slotCount,
      start_slot_utc: start.toISOString()
    }
  });
  if (!paymentSuccess) {
    throw new Error('Payment failed');
  }

  const status = listing.instant_book_enabled === false ? 'pending' : 'confirmed';
  const slotWindows = buildSlotSequence(start, slotCount);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    if (idempotency_key) {
      const existing = await client.query(
        'SELECT * FROM bookings WHERE idempotency_key = $1 AND user_id = $2 LIMIT 1',
        [idempotency_key, user_id]
      );
      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return normalizeBookingRow(existing.rows[0]);
      }
    }

    const insertBooking = await client.query(
      `INSERT INTO bookings (
         space_id,
         user_id,
         host_id,
         start_time,
         end_time,
         start_slot_utc,
         end_slot_utc,
         slot_count,
         guest_count,
         status,
         price_per_hour_snapshot,
         subtotal_amount,
         platform_fee_amount,
         tax_amount,
         total_amount,
         cancellation_policy_snapshot,
         idempotency_key
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
       )
       RETURNING *`,
      [
        space_id,
        user_id,
        listing.owner_id || null,
        start.toISOString(),
        end.toISOString(),
        start.toISOString(),
        end.toISOString(),
        slotCount,
        guestCount,
        status,
        pricePerHour,
        subtotal,
        platformFee,
        taxAmount,
        totalAmount,
        listing.cancellation_policy || 'moderate',
        idempotency_key || null
      ]
    );

    const booking = insertBooking.rows[0];

    for (const slotWindow of slotWindows) {
      try {
        await client.query(
          `INSERT INTO booking_slots (booking_id, space_id, slot_start_utc, slot_end_utc, occupancy_status)
           VALUES ($1, $2, $3, $4, 'active')`,
          [booking.id, space_id, slotWindow.slotStart.toISOString(), slotWindow.slotEnd.toISOString()]
        );
      } catch (error) {
        if (error.code === '23505') {
          throw new Error('Space is already booked for this time slot');
        }
        throw error;
      }
    }

    await client.query(
      `INSERT INTO booking_status_history (booking_id, old_status, new_status, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [booking.id, 'new', status, user_id, null]
    );

    await client.query('COMMIT');

    const normalizedBooking = normalizeBookingRow(booking);

    await publishBookingEvent('BOOKING_CREATED', {
      booking_id: normalizedBooking.id,
      space_id: normalizedBooking.space_id,
      slot_count: normalizedBooking.slot_count,
      status: normalizedBooking.status
    });

    if (status === 'confirmed') {
      await publishBookingEvent('BOOKING_CONFIRMED', {
        booking_id: normalizedBooking.id,
        space_id: normalizedBooking.space_id,
        start_slot_utc: normalizedBooking.start_slot_utc,
        end_slot_utc: normalizedBooking.end_slot_utc,
        slot_count: normalizedBooking.slot_count,
        user_id: normalizedBooking.user_id,
        host_id: normalizedBooking.host_id
      });
    }

    return normalizedBooking;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateBookingStatus(bookingId, status, changedBy = null, reason = null) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const found = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const current = found.rows[0];
    if (current.status === status) {
      await client.query('COMMIT');
      return normalizeBookingRow(current);
    }

    const updatedResult = await client.query(
      `UPDATE bookings
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, bookingId]
    );

    const updated = updatedResult.rows[0];

    await client.query(
      `INSERT INTO booking_status_history (booking_id, old_status, new_status, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [bookingId, current.status, status, changedBy, reason]
    );

    await client.query('COMMIT');

    const normalizedUpdated = normalizeBookingRow(updated);

    if (status === 'confirmed') {
      await publishBookingEvent('BOOKING_CONFIRMED', {
        booking_id: normalizedUpdated.id,
        space_id: normalizedUpdated.space_id,
        start_time: normalizedUpdated.start_time,
        end_time: normalizedUpdated.end_time,
        start_slot_utc: normalizedUpdated.start_slot_utc,
        end_slot_utc: normalizedUpdated.end_slot_utc,
        slot_count: normalizedUpdated.slot_count,
        user_id: normalizedUpdated.user_id,
        host_id: normalizedUpdated.host_id
      });
    }

    return normalizedUpdated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getBookingsByUser(userId) {
  const result = await db.query('SELECT * FROM bookings WHERE user_id=$1 ORDER BY start_time DESC', [userId]);
  return result.rows.map(normalizeBookingRow);
}

async function getBookingsByHost(hostId) {
  const result = await db.query('SELECT * FROM bookings WHERE host_id=$1 ORDER BY start_time DESC', [hostId]);
  return result.rows.map(normalizeBookingRow);
}

async function cancelBooking(bookingId, actorUserId, role, reason) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const found = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    if (found.rows.length === 0) {
      throw new Error('Booking not found');
    }

    const booking = found.rows[0];
    const canCancel =
      role === 'admin' ||
      Number(booking.user_id) === Number(actorUserId) ||
      Number(booking.host_id) === Number(actorUserId);

    if (!canCancel) {
      throw new Error('Forbidden');
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      throw new Error('Booking cannot be cancelled in current state');
    }

    const updatedResult = await client.query(
      `UPDATE bookings
       SET status = 'cancelled',
           cancellation_reason = $1,
           cancelled_at = NOW(),
           refund_amount = total_amount
       WHERE id = $2
       RETURNING *`,
      [reason || null, bookingId]
    );

    await client.query(
      `UPDATE booking_slots
       SET occupancy_status = 'released'
       WHERE booking_id = $1 AND occupancy_status = 'active'`,
      [bookingId]
    );

    await client.query(
      `INSERT INTO booking_status_history (booking_id, old_status, new_status, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [bookingId, booking.status, 'cancelled', actorUserId, reason || null]
    );

    await client.query('COMMIT');

    const updated = normalizeBookingRow(updatedResult.rows[0]);
    await publishBookingEvent('BOOKING_CANCELLED', {
      booking_id: updated.id,
      space_id: updated.space_id,
      cancelled_at: updated.cancelled_at,
      cancelled_by: actorUserId
    });

    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getReservedSlots(spaceId, from, to) {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDateInclusive = new Date(`${to}T00:00:00.000Z`);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDateInclusive.getTime())) {
    throw new Error('from and to must be valid YYYY-MM-DD values');
  }

  const toExclusive = new Date(toDateInclusive.getTime() + 24 * 60 * 60 * 1000);

  const result = await db.query(
    `SELECT slot_start_utc, slot_end_utc
     FROM booking_slots
     WHERE space_id = $1
       AND occupancy_status = 'active'
       AND slot_start_utc >= $2
       AND slot_start_utc < $3
     ORDER BY slot_start_utc ASC`,
    [spaceId, fromDate.toISOString(), toExclusive.toISOString()]
  );

  return result.rows.map((row) => ({
    slot_start_utc: toUtcIsoString(row.slot_start_utc),
    slot_end_utc: toUtcIsoString(row.slot_end_utc)
  }));
}

module.exports = {
  createBooking,
  updateBookingStatus,
  getBookingsByUser,
  getBookingsByHost,
  cancelBooking,
  getReservedSlots
};
