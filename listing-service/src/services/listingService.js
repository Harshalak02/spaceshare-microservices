const db = require('../models/db');
const redis = require('../models/redis');
const http = require('http');
const { DateTime } = require('luxon');
const { getPlan } = require('../strategies/PlanFactory');

const SLOT_CACHE_TTL_SECONDS = Number(process.env.SLOT_CACHE_TTL_SECONDS || 30);
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:4004';
const SUBSCRIPTION_SERVICE_URL = process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:4005';
const INTERNAL_HTTP_TIMEOUT_MS = Number(process.env.INTERNAL_HTTP_TIMEOUT_MS || 5000);

function normalizeTime(value) {
  if (!value) return null;
  const str = String(value);
  return str.length >= 5 ? str.slice(0, 5) : str;
}

function isValidTimezone(timezone) {
  if (!timezone) return false;
  return DateTime.now().setZone(timezone).isValid;
}

function isHourAligned(timeText) {
  return /^([01]\d|2[0-3]):00$/.test(timeText);
}

function compareTimes(openTime, closeTime) {
  return openTime < closeTime;
}

function toCacheDate(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') return dateValue;
  return DateTime.fromJSDate(dateValue).toISODate();
}

function toIsoUtc(value) {
  return DateTime.fromISO(String(value), { zone: 'utc' }).toUTC().toISO({ suppressMilliseconds: true });
}

async function invalidateSlotCache(spaceId) {
  const pattern = `slots:listing:${spaceId}:*`;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('❌ [listing-service] Failed to invalidate slot cache:', error.message);
  }
}

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

async function createSpace(data) {
  const { title, description, location_name, lat, lon, price_per_hour, capacity, owner_id, timezone } = data;
  const selectedTimezone = timezone || 'UTC';
  if (!isValidTimezone(selectedTimezone)) {
    throw new Error('Invalid timezone');
  }

  const planLookup = await fetchUserPlan(owner_id);
  let plan;

  if (planLookup.kind === 'plan') {
    plan = getPlan(planLookup.plan);
  } else if (planLookup.kind === 'none') {
    const error = new Error('No subscription found for user');
    error.code = 'NO_SUBSCRIPTION';
    error.status = 402;
    throw error;
  } else {
    console.warn(
      `[listing-service] Subscription lookup failed for user=${owner_id}. Falling back to free plan.`,
      planLookup.reason || planLookup.status || planLookup.error?.message || 'unknown_error'
    );
    plan = getPlan('free');
  }

  const currentCount = await countUserSpaces(owner_id);
  if (currentCount >= plan.getListingLimit()) {
    const error = new Error('Listing limit reached. Upgrade your plan.');
    error.code = 'PLAN_LIMIT_REACHED';
    error.status = 403;
    throw error;
  }

  const result = await db.query(
    `INSERT INTO spaces (title, description, location_name, lat, lon, price_per_hour, capacity, owner_id, timezone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [title, description || '', location_name || '', lat, lon, price_per_hour, capacity, owner_id, selectedTimezone]
  );
  const space = result.rows[0];
  await publishListingEvent('LISTING_CREATED', { space });
  return space;
}

async function getSpace(id) {
  const result = await db.query('SELECT * FROM spaces WHERE id = $1', [id]);
  return result.rows[0] || null;
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
  const { title, description, location_name, lat, lon, price_per_hour, capacity, timezone } = data;
  const selectedTimezone = timezone || 'UTC';
  if (!isValidTimezone(selectedTimezone)) {
    throw new Error('Invalid timezone');
  }

  const result = await db.query(
    `UPDATE spaces
      SET title=$1,
          description=$2,
          location_name=$3,
          lat=$4,
          lon=$5,
          price_per_hour=$6,
          capacity=$7,
          timezone=$8
     WHERE id=$9 RETURNING *`,
    [title, description || '', location_name || '', lat, lon, price_per_hour, capacity, selectedTimezone, id]
  );
  const space = result.rows[0];
  if (space) {
    await invalidateSlotCache(id);
    await publishListingEvent('LISTING_UPDATED', { space });
  }
  return space;
}

async function deleteSpace(id) {
  await db.query('DELETE FROM spaces WHERE id=$1', [id]);
  await invalidateSlotCache(id);
  await publishListingEvent('LISTING_DELETED', { id: Number(id) });
}

async function getWeeklyAvailability(spaceId) {
  const result = await db.query(
    `SELECT id, space_id, day_of_week, is_open, open_time_local, close_time_local
     FROM listing_weekly_availability
     WHERE space_id = $1
     ORDER BY day_of_week ASC`,
    [spaceId]
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    space_id: Number(row.space_id),
    day_of_week: Number(row.day_of_week),
    is_open: row.is_open,
    open_time_local: normalizeTime(row.open_time_local),
    close_time_local: normalizeTime(row.close_time_local)
  }));
}

async function upsertWeeklyAvailability(spaceId, data) {
  const { timezone, week } = data;
  if (timezone && !isValidTimezone(timezone)) {
    throw new Error('Invalid timezone');
  }

  const weekMap = new Map();
  for (const entry of week) {
    const day = Number(entry.day_of_week);
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      throw new Error('day_of_week must be between 0 and 6');
    }
    weekMap.set(day, entry);
  }

  if (weekMap.size !== 7) {
    throw new Error('week must include all day_of_week values from 0 to 6');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    if (timezone) {
      await client.query('UPDATE spaces SET timezone = $1 WHERE id = $2', [timezone, spaceId]);
    }

    for (let day = 0; day <= 6; day += 1) {
      const entry = weekMap.get(day);
      const isOpen = entry.is_open === true;
      let openTime = null;
      let closeTime = null;

      if (isOpen) {
        openTime = normalizeTime(entry.open_time_local);
        closeTime = normalizeTime(entry.close_time_local);

        if (!openTime || !closeTime) {
          throw new Error(`open_time_local and close_time_local are required for open day ${day}`);
        }
        if (!isHourAligned(openTime) || !isHourAligned(closeTime)) {
          throw new Error(`open_time_local and close_time_local must be hour aligned for day ${day}`);
        }
        if (!compareTimes(openTime, closeTime)) {
          throw new Error(`close_time_local must be greater than open_time_local for day ${day}`);
        }
      }

      await client.query(
        `INSERT INTO listing_weekly_availability (space_id, day_of_week, is_open, open_time_local, close_time_local)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (space_id, day_of_week)
         DO UPDATE SET
           is_open = EXCLUDED.is_open,
           open_time_local = EXCLUDED.open_time_local,
           close_time_local = EXCLUDED.close_time_local,
           updated_at = NOW()`,
        [spaceId, day, isOpen, openTime, closeTime]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await invalidateSlotCache(spaceId);

  const space = await getSpace(spaceId);
  const savedWeek = await getWeeklyAvailability(spaceId);
  return {
    space_id: Number(spaceId),
    timezone: space.timezone,
    slot_minutes: space.slot_minutes,
    week: savedWeek
  };
}

async function getAvailabilityOverrides(spaceId, from, to) {
  let query = `
    SELECT id, space_id, date_local, closed_all_day, open_time_local, close_time_local, note
    FROM listing_availability_overrides
    WHERE space_id = $1`;
  const values = [spaceId];

  if (from) {
    values.push(from);
    query += ` AND date_local >= $${values.length}`;
  }
  if (to) {
    values.push(to);
    query += ` AND date_local <= $${values.length}`;
  }

  query += ' ORDER BY date_local ASC';
  const result = await db.query(query, values);

  return result.rows.map((row) => ({
    id: Number(row.id),
    space_id: Number(row.space_id),
    date_local: toCacheDate(row.date_local),
    closed_all_day: row.closed_all_day,
    open_time_local: normalizeTime(row.open_time_local),
    close_time_local: normalizeTime(row.close_time_local),
    note: row.note || null
  }));
}

async function upsertAvailabilityOverride(spaceId, data) {
  const { date_local, closed_all_day, open_time_local, close_time_local, note } = data;

  if (!DateTime.fromISO(String(date_local), { zone: 'utc' }).isValid) {
    throw new Error('date_local must be a valid YYYY-MM-DD value');
  }

  let openTime = normalizeTime(open_time_local);
  let closeTime = normalizeTime(close_time_local);
  const closedAllDay = closed_all_day === true;

  if (closedAllDay) {
    openTime = null;
    closeTime = null;
  } else {
    if (!openTime || !closeTime) {
      throw new Error('open_time_local and close_time_local are required when closed_all_day=false');
    }
    if (!isHourAligned(openTime) || !isHourAligned(closeTime)) {
      throw new Error('open_time_local and close_time_local must be hour aligned');
    }
    if (!compareTimes(openTime, closeTime)) {
      throw new Error('close_time_local must be greater than open_time_local');
    }
  }

  const result = await db.query(
    `INSERT INTO listing_availability_overrides (space_id, date_local, closed_all_day, open_time_local, close_time_local, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (space_id, date_local)
     DO UPDATE SET
       closed_all_day = EXCLUDED.closed_all_day,
       open_time_local = EXCLUDED.open_time_local,
       close_time_local = EXCLUDED.close_time_local,
       note = EXCLUDED.note,
       updated_at = NOW()
     RETURNING id, space_id, date_local, closed_all_day, open_time_local, close_time_local, note`,
    [spaceId, date_local, closedAllDay, openTime, closeTime, note || null]
  );

  await invalidateSlotCache(spaceId);

  const row = result.rows[0];
  return {
    id: Number(row.id),
    space_id: Number(row.space_id),
    date_local: toCacheDate(row.date_local),
    closed_all_day: row.closed_all_day,
    open_time_local: normalizeTime(row.open_time_local),
    close_time_local: normalizeTime(row.close_time_local),
    note: row.note || null
  };
}

async function deleteAvailabilityOverride(spaceId, overrideId) {
  await db.query('DELETE FROM listing_availability_overrides WHERE id = $1 AND space_id = $2', [overrideId, spaceId]);
  await invalidateSlotCache(spaceId);
}

async function httpGetJson(requestOptions, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = http.get(requestOptions, (response) => {
      let raw = '';
      response.on('data', (chunk) => {
        raw += chunk;
      });
      response.on('end', () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          return reject(new Error(`Booking service responded with status ${response.statusCode || 'unknown'}`));
        }

        try {
          const parsed = raw ? JSON.parse(raw) : {};
          return resolve(parsed);
        } catch (error) {
          return reject(new Error('Invalid JSON received from booking service'));
        }
      });
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`timeout of ${timeoutMs}ms exceeded`));
    });

    request.on('error', (error) => {
      reject(error);
    });
  });
}

async function fetchReservedSlots(spaceId, from, to) {
  const endpoint = new URL(`/internal/listings/${spaceId}/reserved-slots`, BOOKING_SERVICE_URL);
  endpoint.searchParams.set('from', from);
  endpoint.searchParams.set('to', to);

  const requestOptions = {
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    port: endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80),
    path: `${endpoint.pathname}${endpoint.search}`,
    headers: {
      'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || ''
    }
  };

  const payload = await httpGetJson(requestOptions, INTERNAL_HTTP_TIMEOUT_MS);

  return payload?.reserved_slots || [];
}

async function countUserSpaces(ownerId) {
  const result = await db.query('SELECT COUNT(*) FROM spaces WHERE owner_id = $1', [ownerId]);
  return parseInt(result.rows[0].count, 10);
}

function normalizeSubscriptionPlanName(planName) {
  if (typeof planName !== 'string') return null;

  const normalized = planName.trim().toLowerCase();
  if (normalized === 'free' || normalized === 'basic' || normalized === 'pro') {
    return normalized;
  }

  if (normalized === 'host_monthly') return 'basic';
  if (normalized === 'host_quarterly' || normalized === 'host_yearly') return 'pro';
  return null;
}

async function fetchUserPlan(userId) {
  const endpoint = new URL(`/me/${encodeURIComponent(userId)}`, SUBSCRIPTION_SERVICE_URL);

  return new Promise((resolve) => {
    const request = http.get(
      {
        protocol: endpoint.protocol,
        hostname: endpoint.hostname,
        port: endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80),
        path: `${endpoint.pathname}${endpoint.search}`,
        headers: {
          Accept: 'application/json'
        }
      },
      (response) => {
        let raw = '';
        response.on('data', (chunk) => {
          raw += chunk;
        });

        response.on('end', () => {
          const statusCode = response.statusCode || 0;

          if (statusCode === 404) {
            resolve({ kind: 'none' });
            return;
          }

          if (statusCode < 200 || statusCode >= 300) {
            resolve({ kind: 'error', reason: 'bad_response', status: statusCode });
            return;
          }

          try {
            const payload = raw ? JSON.parse(raw) : {};
            const rawPlan = payload?.plan || payload?.plan_type;
            const plan = normalizeSubscriptionPlanName(rawPlan);

            if (!plan) {
              resolve({ kind: 'error', reason: 'unexpected_payload', payload });
              return;
            }

            resolve({ kind: 'plan', plan });
          } catch (error) {
            resolve({ kind: 'error', reason: 'invalid_json', error });
          }
        });
      }
    );

    request.setTimeout(INTERNAL_HTTP_TIMEOUT_MS, () => {
      request.destroy(new Error(`timeout of ${INTERNAL_HTTP_TIMEOUT_MS}ms exceeded`));
    });

    request.on('error', (error) => {
      resolve({ kind: 'error', reason: 'network', error });
    });
  });
}

function getWindowForDay(localDate, weeklyMap, overrideMap) {
  const override = overrideMap.get(localDate);
  if (override) {
    if (override.closed_all_day) return null;
    return {
      open_time_local: normalizeTime(override.open_time_local),
      close_time_local: normalizeTime(override.close_time_local)
    };
  }

  const weekday = DateTime.fromISO(localDate, { zone: 'utc' }).weekday;
  const dayOfWeek = weekday % 7;
  const weekly = weeklyMap.get(dayOfWeek);
  if (!weekly || !weekly.is_open) return null;

  return {
    open_time_local: normalizeTime(weekly.open_time_local),
    close_time_local: normalizeTime(weekly.close_time_local)
  };
}

async function getSlots(spaceId, options) {
  const { from, to, includeUnavailable = false } = options;

  const fromDate = DateTime.fromISO(String(from), { zone: 'utc' });
  const toDate = DateTime.fromISO(String(to), { zone: 'utc' });
  if (!fromDate.isValid || !toDate.isValid) {
    throw new Error('from and to must be valid YYYY-MM-DD values');
  }
  if (toDate < fromDate) {
    throw new Error('to must be on or after from');
  }
  if (toDate.diff(fromDate, 'days').days > 31) {
    throw new Error('Slot range too large. Maximum supported range is 31 days');
  }

  const space = await getSpace(spaceId);
  if (!space) {
    throw new Error('Space not found');
  }

  const timezone = space.timezone || 'UTC';
  if (!isValidTimezone(timezone)) {
    throw new Error('Invalid listing timezone configured');
  }

  const cacheKey = `slots:listing:${spaceId}:from:${from}:to:${to}:all:${includeUnavailable ? '1' : '0'}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const weekly = await getWeeklyAvailability(spaceId);
  const overrides = await getAvailabilityOverrides(spaceId, from, to);

  const weeklyMap = new Map(weekly.map((item) => [item.day_of_week, item]));
  const overrideMap = new Map(overrides.map((item) => [item.date_local, item]));

  const reservedSlots = await fetchReservedSlots(spaceId, from, to);
  const reservedSet = new Set(
    reservedSlots.map((slot) => toIsoUtc(slot.slot_start_utc))
  );

  const slots = [];
  let cursor = fromDate;
  while (cursor <= toDate) {
    const localDate = cursor.toISODate();
    const window = getWindowForDay(localDate, weeklyMap, overrideMap);

    if (window && window.open_time_local && window.close_time_local) {
      let slotStart = DateTime.fromISO(`${localDate}T${window.open_time_local}`, { zone: timezone });
      const dayEnd = DateTime.fromISO(`${localDate}T${window.close_time_local}`, { zone: timezone });

      while (slotStart < dayEnd) {
        const slotEnd = slotStart.plus({ hours: 1 });
        const startUtc = slotStart.toUTC().toISO({ suppressMilliseconds: true });
        const endUtc = slotEnd.toUTC().toISO({ suppressMilliseconds: true });
        const status = reservedSet.has(startUtc) ? 'reserved' : 'available';

        if (includeUnavailable || status === 'available') {
          slots.push({
            slot_start_utc: startUtc,
            slot_end_utc: endUtc,
            slot_start_local: slotStart.toISO({ suppressMilliseconds: true }),
            slot_end_local: slotEnd.toISO({ suppressMilliseconds: true }),
            status
          });
        }

        slotStart = slotEnd;
      }
    }

    cursor = cursor.plus({ days: 1 });
  }

  const payload = {
    listing_id: Number(spaceId),
    timezone,
    slot_minutes: Number(space.slot_minutes || 60),
    from,
    to,
    slots
  };

  await redis.set(cacheKey, JSON.stringify(payload), 'EX', SLOT_CACHE_TTL_SECONDS);
  return payload;
}

module.exports = {
  createSpace,
  getSpace,
  getAllSpaces,
  getSpacesByOwner,
  updateSpace,
  deleteSpace,
  getWeeklyAvailability,
  upsertWeeklyAvailability,
  getAvailabilityOverrides,
  upsertAvailabilityOverride,
  deleteAvailabilityOverride,
  getSlots,
  invalidateSlotCache
};
