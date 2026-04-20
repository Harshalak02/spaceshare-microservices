const service = require('../services/subscriptionService');

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
    res.json(sub);
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

module.exports = { create, get, checkActive };
