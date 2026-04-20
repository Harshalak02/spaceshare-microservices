const db = require('../models/db');
const redis = require('../models/redis');

function buildKey(params) {
  const { lat, lon, radius, min_price, max_price, capacity } = params;
  return `search:lat:${lat}:lon:${lon}:radius:${radius}:price:${min_price}-${max_price}:capacity:${capacity}`;
}

async function searchSpaces(params) {
  const ttl = Number(process.env.CACHE_TTL_SECONDS || 300);
  const key = buildKey(params);

  const cached = await redis.get(key);
  if (cached) {
    return { source: 'cache', space_ids: JSON.parse(cached) };
  }

  const lat = Number(params.lat);
  const lon = Number(params.lon);
  const radius = Number(params.radius || 0.1);
  const minPrice = Number(params.min_price || 0);
  const maxPrice = Number(params.max_price || 100000);
  const capacity = Number(params.capacity || 1);

  const query = `
    SELECT id FROM spaces
    WHERE lat BETWEEN $1 AND $2
      AND lon BETWEEN $3 AND $4
      AND price_per_hour BETWEEN $5 AND $6
      AND capacity >= $7
  `;

  const result = await db.query(query, [lat - radius, lat + radius, lon - radius, lon + radius, minPrice, maxPrice, capacity]);
  const ids = result.rows.map((row) => row.id);

  await redis.set(key, JSON.stringify(ids), 'EX', ttl);
  return { source: 'db', space_ids: ids };
}

module.exports = { searchSpaces };
