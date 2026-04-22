const service = require('../services/subscriptionService');

function normalizeSubscription(sub) {
  if (!sub) return null;
  return {
    id: sub.id,
    user_id: sub.user_id,
    plan: sub.plan_type,
    plan_type: sub.plan_type,
    expiry_date: sub.expiry_date,
    created_at: sub.created_at
  };
}

async function create(req, res) {
  try {
    const subscription = await service.subscribe(req.body);
    res.status(201).json(normalizeSubscription(subscription));
  } catch (error) {
    res.status(error.status || 500).json({ message: 'Subscription failed', error: error.message });
  }
}

async function get(req, res) {
  try {
    const sub = await service.getByUser(req.params.user_id);
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });

    res.json(normalizeSubscription(sub));
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
    const subscription = await service.getByUser(userId);
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    res.json({
      plan: subscription.plan_type,
      plan_type: subscription.plan_type,
      user_id: subscription.user_id,
      subscription_id: subscription.id,
      expiry_date: subscription.expiry_date
    });
  } catch (err) {
    console.error("❌ Subscription fetch error:", err);
    res.status(500).json({ message: 'Failed to fetch subscription' });
  }
}

async function getPlans(req, res) {
  try {
    res.json(service.getAvailablePlans());
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch plans', error: error.message });
  }
}

module.exports = { create, get, checkActive, getUserSubscription, getPlans };
