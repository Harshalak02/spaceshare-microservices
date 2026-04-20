const db = require('../models/db');

async function subscribe(data) {
  const { user_id, plan_type } = data;
  // Mock Stripe: simply create a 30-day subscription.
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const result = await db.query(
    'INSERT INTO subscriptions (user_id, plan_type, expiry_date) VALUES ($1, $2, $3) RETURNING *',
    [user_id, plan_type, expiry]
  );
  return result.rows[0];
}

async function getByUser(userId) {
  const result = await db.query('SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
  return result.rows[0] || null;
}

async function isHostActive(userId) {
  const result = await db.query(
    'SELECT * FROM subscriptions WHERE user_id = $1 AND expiry_date > NOW() ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  return result.rows.length > 0;
}

module.exports = { subscribe, getByUser, isHostActive };
