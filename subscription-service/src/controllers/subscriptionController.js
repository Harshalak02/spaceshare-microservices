const service = require('../services/subscriptionService');
const db = require('../models/db');
async function create(req, res) {
  try {
    const subscription = await service.subscribe(req.body);
    res.status(201).json(subscription);
  } catch (error) {
    res.status(500).json({ message: 'Subscription failed', error: error.message });
  }
}

async function get(req, res) {
  try {
    const sub = await service.getByUser(req.params.user_id);
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });

    // Normalize response shape for consistency across clients
    const normalized = {
      id: sub.id,
      user_id: sub.user_id,
      plan: sub.plan_type,
      expiry_date: sub.expiry_date,
      created_at: sub.created_at
    };
    res.json(normalized);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get subscription', error: error.message });
  }
}

async function checkActive(req, res) {
  try {
    const active = await service.isHostActive(req.params.user_id);
    res.json({ active });
  } catch (error) {
    res.status(500).json({ message: 'Check failed', error: error.message });
  }
}
async function getUserSubscription(req, res) {
  try {
    const userId = req.params.userId;

    const result = await db.query(
      'SELECT plan_type FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (!result.rows[0]) {
      // No subscription should be signaled explicitly (404) so callers can prompt
      // the user to select a plan. Do NOT silently return a "free" plan.
      return res.status(404).json({ message: 'Subscription not found' });
    }

    res.json({ plan: result.rows[0].plan_type });

  } catch (err) {
    console.error("❌ Subscription fetch error:", err);
    res.status(500).json({ message: 'Failed to fetch subscription' });
  }
}
module.exports = { create, get, checkActive, getUserSubscription };
