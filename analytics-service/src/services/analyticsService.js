const db = require('../models/db');

async function logEvent(event) {
  try {
    await db.query(
      'INSERT INTO events (event_type, payload) VALUES ($1, $2)',
      [event.type, JSON.stringify(event.payload)]
    );
  } catch (err) {
    console.error('❌ [analytics-service] Failed to log event:', err.message);
  }
}

async function getEvents() {
  const result = await db.query('SELECT * FROM events ORDER BY created_at DESC LIMIT 100');
  return result.rows;
}

module.exports = { logEvent, getEvents };
