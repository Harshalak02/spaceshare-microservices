const db = require('../models/db');

async function logEvent(event) {
  await db.query('INSERT INTO events (event_type, payload) VALUES ($1, $2)', [event.type, event.payload]);
}

module.exports = { logEvent };
