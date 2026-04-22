const db = require('../models/db');
const redis = require('../models/redis');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { getPlan } = require('../strategies/PlanFactory');
async function publishListingEvent(type, payload) {
  try {
    await redis.publish('events', JSON.stringify({
      type,
      timestamp: new Date().toISOString(),
      payload
    }));
  } catch (error) {
    console.error(`❌ [listing-service] Failed to publish ${type}:`, error.message);
  }
}

function normalizeAmenities(amenities) {
  if (!Array.isArray(amenities)) return [];

  return [...new Set(
    amenities
      .map((amenity) => (typeof amenity === 'string' ? amenity.trim() : ''))
      .filter((amenity) => amenity.length > 0)
  )];
}

async function ensureAmenity(client, amenityName) {
  const existing = await client.query('SELECT id FROM amenities WHERE name = $1', [amenityName]);
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    'INSERT INTO amenities(name) VALUES($1) RETURNING id',
    [amenityName]

  );
  return inserted.rows[0].id;
}

async function linkAmenitiesToSpace(client, spaceId, amenities) {
  const normalizedAmenities = normalizeAmenities(amenities);

  for (const amenityName of normalizedAmenities) {
    const amenityId = await ensureAmenity(client, amenityName);
    await client.query(
      'INSERT INTO space_amenities(space_id, amenity_id) VALUES($1, $2)',
      [spaceId, amenityId]
    );
  }

  return normalizedAmenities;
}


async function getAmenitiesBySpaceId(client, spaceId) {
  const result = await client.query(
    `SELECT a.name
     FROM amenities a
     JOIN space_amenities sa ON a.id = sa.amenity_id
     WHERE sa.space_id = $1
     ORDER BY a.name ASC`,
    [spaceId]
  );
  return result.rows.map((row) => row.name);
}

async function createSpace(data) {
  const { title, description, location_name, lat, lon, price_per_hour, capacity, owner_id, amenities } = data;
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    // 🚀 Subscription enforcement/error handling block
    const planResult = await getUserPlan(owner_id);

    if (planResult.kind === 'plan') {
      const plan = getPlan(planResult.plan);
      const currentCount = await countUserSpaces(client, owner_id);

      if (currentCount >= plan.getListingLimit()) {
        const err = new Error('Listing limit reached. Upgrade your plan.');
        err.code = 'PLAN_LIMIT_REACHED';
        err.status = 403;
        throw err;
      }
    } else if (planResult.kind === 'none') {
      const err = new Error('No subscription found for user');
      err.code = 'NO_SUBSCRIPTION';
      err.status = 402;
      throw err;
    } else {
      console.warn(
        `[listing-service] Subscription lookup failed for user=${owner_id}:`,
        planResult.reason || planResult.error?.message || planResult
      );

      // ✅ FALLBACK (VERY IMPORTANT)
      const plan = getPlan('free');

      const currentCount = await countUserSpaces(client, owner_id);

      if (currentCount >= plan.getListingLimit()) {
        const err = new Error('Listing limit reached. Upgrade your plan.');
        err.code = 'PLAN_LIMIT_REACHED';
        err.status = 403;
        throw err;
      }
    }
    const result = await client.query(
      `INSERT INTO spaces (title, description, location_name, lat, lon, price_per_hour, capacity, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description || '', location_name || '', lat, lon, price_per_hour, capacity, owner_id]
    );

    const space = result.rows[0];
    let normalizedAmenities = [];

    try {
      normalizedAmenities = await linkAmenitiesToSpace(client, space.id, amenities);
    } catch (e) {
      console.warn("Amenities linking failed:", e.message);
    }

    await client.query('COMMIT');

    const createdSpace = { ...space, amenities: normalizedAmenities };
    await publishListingEvent('LISTING_CREATED', { space: createdSpace });
    return createdSpace;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


async function getSpace(id) {
  const client = await db.connect();

  try {
    const result = await client.query('SELECT * FROM spaces WHERE id = $1', [id]);
    const space = result.rows[0];
    if (!space) return null;

    const amenities = await getAmenitiesBySpaceId(client, id);
    return { ...space, amenities };
  } finally {
    client.release();
  }

}

async function getAllSpaces() {
  const result = await db.query('SELECT * FROM spaces ORDER BY created_at DESC');
  return result.rows;
}

async function getSpacesByOwner(ownerId) {
  const result = await db.query('SELECT * FROM spaces WHERE owner_id = $1 ORDER BY created_at DESC', [ownerId]);
  return result.rows;
}

async function updateSpace(id, data) {
  const { title, description, location_name, lat, lon, price_per_hour, capacity, amenities } = data;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE spaces SET title=$1, description=$2, location_name=$3, lat=$4, lon=$5, price_per_hour=$6, capacity=$7
       WHERE id=$8 RETURNING *`,
      [title, description || '', location_name || '', lat, lon, price_per_hour, capacity, id]
    );

    const space = result.rows[0];
    if (!space) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query('DELETE FROM space_amenities WHERE space_id = $1', [id]);
    const normalizedAmenities = await linkAmenitiesToSpace(client, id, amenities);

    await client.query('COMMIT');

    const updatedSpace = { ...space, amenities: normalizedAmenities };
    await publishListingEvent('LISTING_UPDATED', { space: updatedSpace });
    return updatedSpace;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();

  }
}
async function getAllAmenities() {
  const result = await db.query(
    'SELECT id, name FROM amenities ORDER BY name ASC'
  );
  return result.rows;
}
async function deleteSpace(id) {
  await db.query('DELETE FROM spaces WHERE id=$1', [id]);
  await publishListingEvent('LISTING_DELETED', { id: Number(id) });
}

module.exports = {
  createSpace,
  getSpace,
  getAllSpaces,
  getSpacesByOwner,
  updateSpace,
  deleteSpace,
  getAllAmenities
};

// --- Helper functions ---
async function countUserSpaces(client, ownerId) {
  const result = await client.query('SELECT COUNT(*) FROM spaces WHERE owner_id = $1', [ownerId]);
  return parseInt(result.rows[0].count, 10);
}

async function getUserPlan(userId) {
  const base = process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:4005';
  const url = `${base}/me/${encodeURIComponent(userId)}`;

  // small timeout using AbortController
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal, headers: { 'Accept': 'application/json' } });
    clearTimeout(timeout);

    if (res.status === 404) {
      return { kind: 'none' };
    }

    if (!res.ok) {
      let body = null;
      try { body = await res.json(); } catch (e) { body = await res.text().catch(() => null); }
      return { kind: 'error', reason: 'bad_response', status: res.status, body };
    }

    let json = null;
    try {
      json = await res.json();
    } catch (e) {
      return { kind: 'error', reason: 'invalid_json', error: e };
    }

    const planName = (typeof json?.plan === 'string' && json.plan.trim())
      || (typeof json?.plan_type === 'string' && json.plan_type.trim());

    if (!planName) {
      return { kind: 'error', reason: 'unexpected_payload', payload: json };
    }

    return { kind: 'plan', plan: planName.toLowerCase() };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { kind: 'error', reason: 'timeout', error: err };
    }
    return { kind: 'error', reason: 'network', error: err };
  } finally {
    clearTimeout(timeout);
  }
}