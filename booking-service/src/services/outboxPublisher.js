/**
 * Outbox Publisher — PostgreSQL-based reliable event publishing.
 *
 * Architecture pattern: Transactional Outbox — instead of publishing events
 * directly to Redis pub/sub after COMMIT (which can fail if the process
 * crashes between COMMIT and publish), events are written to an `outbox_events`
 * table within the same DB transaction. A background poller then reads unpublished
 * events and delivers them to Redis pub/sub.
 *
 * This guarantees at-least-once delivery without needing external message queues.
 */

const db = require('../models/db');
const redis = require('../models/redis');

const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS || 2000);
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE || 50);

let pollTimer = null;

/**
 * Insert an outbox event within an existing transaction.
 *
 * @param {object} client - The PG client from the active transaction.
 * @param {string} aggregateType - e.g., 'booking'
 * @param {number|string} aggregateId - e.g., booking.id
 * @param {string} eventType - e.g., 'BOOKING_CONFIRMED'
 * @param {object} payload - Event payload object.
 */
async function insertOutboxEvent(client, aggregateType, aggregateId, eventType, payload) {
  await client.query(
    `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
     VALUES ($1, $2, $3, $4)`,
    [aggregateType, aggregateId, eventType, JSON.stringify(payload)]
  );
}

/**
 * Poll the outbox table for unpublished events, publish them to Redis,
 * and mark them as published.
 */
async function pollAndPublish() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // SELECT ... FOR UPDATE SKIP LOCKED ensures multiple pollers don't collide.
    const result = await client.query(
      `SELECT id, event_type, payload, created_at
       FROM outbox_events
       WHERE published = FALSE
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [BATCH_SIZE]
    );

    if (result.rows.length === 0) {
      await client.query('COMMIT');
      return 0;
    }

    const publishedIds = [];

    for (const row of result.rows) {
      try {
        const eventMessage = JSON.stringify({
          type: row.event_type,
          timestamp: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
          payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
        });

        await redis.publish('events', eventMessage);
        publishedIds.push(row.id);
      } catch (publishError) {
        console.error(`❌ [outbox] Failed to publish event ${row.id}:`, publishError.message);
        // Skip this event — it will be retried on next poll
      }
    }

    if (publishedIds.length > 0) {
      await client.query(
        `UPDATE outbox_events
         SET published = TRUE, published_at = NOW()
         WHERE id = ANY($1::bigint[])`,
        [publishedIds]
      );
    }

    await client.query('COMMIT');
    return publishedIds.length;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [outbox] Poll cycle failed:', error.message);
    return 0;
  } finally {
    client.release();
  }
}

/** Start the background outbox poller. */
function startOutboxPoller() {
  if (pollTimer) return;

  console.log(`✅ [outbox] Poller started (interval=${POLL_INTERVAL_MS}ms, batch=${BATCH_SIZE})`);

  pollTimer = setInterval(async () => {
    try {
      const count = await pollAndPublish();
      if (count > 0) {
        console.log(`✅ [outbox] Published ${count} event(s)`);
      }
    } catch (error) {
      console.error('❌ [outbox] Poller iteration error:', error.message);
    }
  }, POLL_INTERVAL_MS);
}

/** Stop the background outbox poller. */
function stopOutboxPoller() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('🛑 [outbox] Poller stopped');
  }
}

module.exports = { insertOutboxEvent, startOutboxPoller, stopOutboxPoller, pollAndPublish };
