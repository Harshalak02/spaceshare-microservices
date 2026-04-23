const db = require('../models/db');
const redis = require('../models/redis');

function buildKey(params) {
  const { lat, lon, radius, min_price, max_price, capacity } = params;
  return `search:${lat}:${lon}:${radius || 5}:${min_price || 0}-${max_price || 100000}:${capacity || 1}`;
}

async function searchSpaces(params) {
  const ttl = Number(process.env.CACHE_TTL_SECONDS || 300);
  const key = buildKey(params);

  // Check Redis cache
  const cached = await redis.get(key);
  if (cached) {
    return { source: 'cache', spaces: JSON.parse(cached) };
  }

  const lat = Number(params.lat);
  const lon = Number(params.lon);
  const radiusKm = Number(params.radius || 5);
  const minPrice = Number(params.min_price || 0);
  const maxPrice = Number(params.max_price || 100000);
  const capacity = Number(params.capacity || 1);

  // Convert km to degrees (approx: 1 degree ≈ 111 km)
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

  const query = `
    SELECT id, title, description, location_name, lat, lon, price_per_hour, capacity, owner_id, image_urls, created_at
    FROM spaces
    WHERE lat BETWEEN $1 AND $2
      AND lon BETWEEN $3 AND $4
      AND price_per_hour BETWEEN $5 AND $6
      AND capacity >= $7
    ORDER BY created_at DESC
  `;

  const result = await db.query(query, [
    lat - latDelta, lat + latDelta,
    lon - lonDelta, lon + lonDelta,
    minPrice, maxPrice,
    capacity
  ]);

  const spaces = result.rows;

  // Cache result
  await redis.set(key, JSON.stringify(spaces), 'EX', ttl);
  return { source: 'db', spaces };
}

module.exports = { searchSpaces };
