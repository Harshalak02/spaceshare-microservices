const db = require('../models/db');
const redis = require('../models/redis');
const http = require('http');
const { parseUtcInput, toUtcIsoString } = require('../utils/dateTime');
const { CircuitBreaker } = require('../utils/circuitBreaker');
const { withRetry } = require('../utils/retry');
const { insertOutboxEvent } = require('./outboxPublisher');

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
const PAYMENT_WINDOW_SECONDS = Math.max(1, Number(process.env.PAYMENT_UI_WINDOW_SECONDS || 60));
const STALE_PENDING_RELEASE_SECONDS = Math.max(1, Number(process.env.STALE_PENDING_RELEASE_SECONDS || 120));
const DEFAULT_PAGE_SIZE = Number(process.env.BOOKING_DEFAULT_PAGE_SIZE || 50);
const MAX_PAGE_SIZE = Number(process.env.BOOKING_MAX_PAGE_SIZE || 200);

// ──────────────────────────────────────────────────────────
// Fix 1: Booking State Machine Guards
// Design pattern: State Machine — explicit transition map
// ensures only valid lifecycle transitions are allowed.
// ──────────────────────────────────────────────────────────
const VALID_TRANSITIONS = {
  pending:   ['confirmed', 'cancelled', 'expired'],
  confirmed: ['cancelled', 'completed'],
  cancelled: [],  // terminal state
  completed: [],  // terminal state
  expired:   [],  // terminal state
};

function isValidTransition(fromStatus, toStatus) {
  const allowed = VALID_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

// ──────────────────────────────────────────────────────────
// Fix 4: Circuit Breaker for Listing Service calls
// Architecture tactic: Fault Isolation — fast-fail when
// listing-service is consistently unavailable.
// ──────────────────────────────────────────────────────────
const listingCircuitBreaker = new CircuitBreaker('listing-service', {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 2,
  rollingWindowMs: 60000,
});

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

function getPaymentWindow(now = new Date()) {
  const startedAt = now;
  const expiresAt = new Date(now.getTime() + PAYMENT_WINDOW_SECONDS * 1000);
  return { startedAt, expiresAt };
}

// ──────────────────────────────────────────────────────────
// Legacy direct publish — kept as fallback; primary delivery
// now goes through the outbox table (Fix 8).
// ──────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────
// Fix 4 + Fix 5: Circuit Breaker + Retry on listing fetch.
// The listing fetch is wrapped in retry (for transient failures)
// and circuit breaker (for sustained failures).
// ──────────────────────────────────────────────────────────
async function fetchListingSnapshot(spaceId) {
  return listingCircuitBreaker.execute(() =>
    withRetry(
      () => {
        const endpoint = new URL(`/spaces/${spaceId}`, LISTING_SERVICE_URL);
        const requestOptions = {
          protocol: endpoint.protocol,
          hostname: endpoint.hostname,
          port: endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80),
          path: `${endpoint.pathname}${endpoint.search}`
        };
        return httpGetJson(requestOptions, INTERNAL_HTTP_TIMEOUT_MS);
      },
      {
        maxRetries: 3,
        baseDelayMs: 200,
        maxDelayMs: 2000,
        retryableErrors: (error) => {
          // Don't retry 404s (listing genuinely not found)
          return !error.message.includes('not found');
        }
      }
    )
  );
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
  const status = 'pending';
  const slotWindows = buildSlotSequence(start, slotCount);
  const { startedAt: paymentWindowStartedAt, expiresAt: paymentWindowExpiresAt } = getPaymentWindow();

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

    const slotStarts = slotWindows.map((slotWindow) => slotWindow.slotStart.toISOString());
    const staleCutoff = new Date(Date.now() - STALE_PENDING_RELEASE_SECONDS * 1000);

    await client.query(
      `WITH stale_bookings AS (
         SELECT DISTINCT b.id
         FROM bookings b
         JOIN booking_slots bs ON bs.booking_id = b.id
         WHERE b.status = 'pending'
           AND b.payment_window_started_at <= $1
           AND bs.space_id = $2
           AND bs.occupancy_status = 'active'
           AND bs.slot_start_utc = ANY($3::timestamp[])
       )
       DELETE FROM bookings b
       USING stale_bookings s
       WHERE b.id = s.id`,
      [staleCutoff.toISOString(), space_id, slotStarts]
    );

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
         payment_window_started_at,
         payment_window_expires_at,
         idempotency_key
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
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
        paymentWindowStartedAt.toISOString(),
        paymentWindowExpiresAt.toISOString(),
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

    // ── Fix 8: Write events to outbox within the same transaction ──
    await insertOutboxEvent(client, 'booking', booking.id, 'BOOKING_CREATED', {
      booking_id: booking.id,
      space_id: booking.space_id,
      slot_count: booking.slot_count,
      status: booking.status,
    });

    await client.query('COMMIT');

    const normalizedBooking = normalizeBookingRow(booking);

    return normalizedBooking;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function cleanupStalePendingBookings() {
  const staleCutoff = new Date(Date.now() - STALE_PENDING_RELEASE_SECONDS * 1000);
  const result = await db.query(
    `DELETE FROM bookings
     WHERE status = 'pending'
       AND payment_window_started_at <= $1
     RETURNING id, space_id`,
    [staleCutoff.toISOString()]
  );

  // Publish BOOKING_EXPIRED events for analytics and notifications
  for (const row of result.rows) {
    await publishBookingEvent('BOOKING_EXPIRED', {
      booking_id: row.id,
      space_id: row.space_id,
      reason: 'Payment window expired',
    });
  }

  return result.rows;
}

// ──────────────────────────────────────────────────────────
// Fix 1: State Machine guard applied to updateBookingStatus.
// Rejects transitions not in VALID_TRANSITIONS map.
// ──────────────────────────────────────────────────────────
async function updateBookingStatus(bookingId, status, changedBy = null, reason = null) {
  const parsedChangedBy = Number(changedBy);
  const resolvedChangedBy = Number.isInteger(parsedChangedBy) && parsedChangedBy > 0 ? parsedChangedBy : 0;

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

    // ── State Machine Guard ──
    if (!isValidTransition(current.status, status)) {
      await client.query('ROLLBACK');
      throw new Error(
        `Invalid state transition: cannot move from '${current.status}' to '${status}'`
      );
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
      [bookingId, current.status, status, resolvedChangedBy, reason]
    );

    // ── Fix 8: Write confirmation/completion events to outbox ──
    if (status === 'confirmed') {
      await insertOutboxEvent(client, 'booking', bookingId, 'BOOKING_CONFIRMED', {
        booking_id: updated.id,
        space_id: updated.space_id,
        start_time: toUtcIsoString(updated.start_time),
        end_time: toUtcIsoString(updated.end_time),
        start_slot_utc: toUtcIsoString(updated.start_slot_utc),
        end_slot_utc: toUtcIsoString(updated.end_slot_utc),
        slot_count: updated.slot_count,
        user_id: updated.user_id,
        host_id: updated.host_id,
      });
    }

    await client.query('COMMIT');

    return normalizeBookingRow(updated);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────────────────
// Fix 10: Pagination for booking queries.
// Prevents unbounded result sets at scale (50K users).
// ──────────────────────────────────────────────────────────
function resolvePagination(options = {}) {
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(options.limit || DEFAULT_PAGE_SIZE)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function getBookingsByUser(userId, options = {}) {
  const { page, limit, offset } = resolvePagination(options);

  const countResult = await db.query('SELECT COUNT(*) FROM bookings WHERE user_id=$1', [userId]);
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await db.query(
    'SELECT * FROM bookings WHERE user_id=$1 ORDER BY start_time DESC LIMIT $2 OFFSET $3',
    [userId, limit, offset]
  );

  return {
    data: result.rows.map(normalizeBookingRow),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getBookingsByHost(hostId, options = {}) {
  const { page, limit, offset } = resolvePagination(options);

  const countResult = await db.query('SELECT COUNT(*) FROM bookings WHERE host_id=$1', [hostId]);
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await db.query(
    'SELECT * FROM bookings WHERE host_id=$1 ORDER BY start_time DESC LIMIT $2 OFFSET $3',
    [hostId, limit, offset]
  );

  return {
    data: result.rows.map(normalizeBookingRow),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
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

    // ── Fix 8: Cancellation event via outbox ──
    const updated = updatedResult.rows[0];
    await insertOutboxEvent(client, 'booking', bookingId, 'BOOKING_CANCELLED', {
      booking_id: updated.id,
      space_id: updated.space_id,
      cancelled_at: toUtcIsoString(updated.cancelled_at),
      cancelled_by: actorUserId,
    });

    await client.query('COMMIT');

    return normalizeBookingRow(updated);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deletePendingBooking(bookingId, actorUserId, role, reason = null) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const found = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    if (found.rows.length === 0) {
      throw new Error('Booking not found');
    }

    const booking = found.rows[0];
    const canDelete =
      role === 'admin' ||
      Number(booking.user_id) === Number(actorUserId) ||
      Number(booking.host_id) === Number(actorUserId);

    if (!canDelete) {
      throw new Error('Forbidden');
    }

    if (booking.status !== 'pending') {
      throw new Error('Only pending bookings can be deleted');
    }

    // ── Fix 8: Write cancellation event to outbox before deleting ──
    await insertOutboxEvent(client, 'booking', bookingId, 'BOOKING_CANCELLED', {
      booking_id: booking.id,
      space_id: booking.space_id,
      cancelled_at: new Date().toISOString(),
      cancelled_by: actorUserId,
      reason: reason || 'Payment not completed; booking deleted',
    });

    await client.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
    await client.query('COMMIT');

    return { deleted: true, booking_id: booking.id, space_id: booking.space_id };
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
    `SELECT
       to_char(slot_start_utc, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS slot_start_utc,
       to_char(slot_end_utc, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS slot_end_utc
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

/** Expose circuit breaker status for health checks. */
function getCircuitBreakerStatus() {
  return listingCircuitBreaker.getStatus();
}

module.exports = {
  createBooking,
  updateBookingStatus,
  getBookingsByUser,
  getBookingsByHost,
  cancelBooking,
  deletePendingBooking,
  getReservedSlots,
  cleanupStalePendingBookings,
  getCircuitBreakerStatus,
  VALID_TRANSITIONS,
};
