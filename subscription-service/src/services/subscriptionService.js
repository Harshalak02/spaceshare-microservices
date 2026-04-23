const db = require('../models/db');

const PLAN_CONFIG = {
  free: {
    code: 'free',
    name: 'Free',
    duration_days: 30,
    listing_limit: 2
  },
  basic: {
    code: 'basic',
    name: 'Basic',
    duration_days: 30,
    listing_limit: 5
  },
  pro: {
    code: 'pro',
    name: 'Pro',
    duration_days: 30,
    listing_limit: 10
  }
};

const LEGACY_PLAN_MAP = {
  host_monthly: 'basic',
  host_quarterly: 'pro',
  host_yearly: 'pro'
};

function normalizePlanType(planType) {
  if (!planType || typeof planType !== 'string') return null;

  const normalized = planType.trim().toLowerCase();
  if (PLAN_CONFIG[normalized]) return normalized;
  if (LEGACY_PLAN_MAP[normalized]) return LEGACY_PLAN_MAP[normalized];
  return null;
}

function getExpiryDateForPlan(planType) {
  const config = PLAN_CONFIG[planType];
  const durationDays = config?.duration_days || 30;
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

async function subscribe(data) {
  const { user_id, plan_type } = data;
  if (!user_id || !plan_type) {
    const error = new Error('user_id and plan_type are required');
    error.status = 400;
    throw error;
  }

  const normalizedPlanType = normalizePlanType(plan_type);
  if (!normalizedPlanType) {
    const error = new Error('Invalid plan_type. Allowed values: free, basic, pro');
    error.status = 400;
    throw error;
  }

  const expiry = getExpiryDateForPlan(normalizedPlanType);
  const result = await db.query(
    'INSERT INTO subscriptions (user_id, plan_type, expiry_date) VALUES ($1, $2, $3) RETURNING *',
    [user_id, normalizedPlanType, expiry]
  );
  return result.rows[0];
}

async function getByUser(userId) {
  const result = await db.query(
    'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
    [userId]
  );
  return result.rows[0] || null;
}

async function isHostActive(userId) {
  const result = await db.query(
    'SELECT * FROM subscriptions WHERE user_id = $1 AND expiry_date > NOW() ORDER BY created_at DESC, id DESC LIMIT 1',
    [userId]
  );
  return result.rows.length > 0;
}

function getAvailablePlans() {
  return Object.values(PLAN_CONFIG);
}

module.exports = { subscribe, getByUser, isHostActive, getAvailablePlans, normalizePlanType };
