const db = require('../models/db');
const redis = require('../models/redis');

const VALID_SORT_OPTIONS = new Set(['distance', 'price_asc', 'price_desc', 'capacity_desc', 'newest']);
const DEFAULT_RADIUS_KM = 10;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function buildCacheKey(params) {
  const {
    lat, lon, radiusKm,
    min_price, max_price, capacity,
    q, sort_by, page, limit
  } = params;
  return `search:${lat}:${lon}:${radiusKm || DEFAULT_RADIUS_KM}:${min_price || 0}-${max_price || 100000}:${capacity || 1}:q=${q || ''}:sort=${sort_by || 'distance'}:p=${page || 1}:l=${limit || DEFAULT_LIMIT}`;
}

function getSortClause(sortBy) {
  switch (sortBy) {
    case 'price_asc':
      return 'price_per_hour ASC, dist_sq ASC';
    case 'price_desc':
      return 'price_per_hour DESC, dist_sq ASC';
    case 'capacity_desc':
      return 'capacity DESC, dist_sq ASC';
    case 'newest':
      return 'created_at DESC, dist_sq ASC';
    case 'distance':
    default:
      return 'dist_sq ASC';
  }
}

async function searchSpaces(params) {
  const ttl = Number(process.env.CACHE_TTL_SECONDS || 300);
  const key = buildCacheKey(params);

  // Check Redis cache
  const cached = await redis.get(key);
  if (cached) {
    return { source: 'cache', spaces: JSON.parse(cached) };
  }

  const lat = Number(params.lat);
  const lon = Number(params.lon);
  const radiusKm = Number(params.radiusKm || params.radius || DEFAULT_RADIUS_KM);
  const minPrice = Number(params.min_price || 0);
  const maxPrice = Number(params.max_price || 100000);
  const capacity = Number(params.capacity || 1);
  const textQuery = (params.q || '').trim().toLowerCase();
  const sortBy = VALID_SORT_OPTIONS.has(params.sort_by) ? params.sort_by : 'distance';
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.limit || DEFAULT_LIMIT)));
  const offset = (page - 1) * limit;

  // Convert km to approximate degrees (1 degree ≈ 111 km)
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

  // Build parameterized query values
  const values = [
    lat - latDelta,   // $1 - lat lower bound
    lat + latDelta,   // $2 - lat upper bound
    lon - lonDelta,   // $3 - lon lower bound
    lon + lonDelta,   // $4 - lon upper bound
    lat,              // $5 - center lat (for distance calc)
    lon,              // $6 - center lon (for distance calc)
    minPrice,         // $7 - min price
    maxPrice,         // $8 - max price
    capacity,         // $9 - min capacity
  ];

  // Stage A (CTE): geo bounding-box pre-filter
  // Stage B (main): apply remaining filters, sort, paginate
  let textFilter = '';
  if (textQuery) {
    values.push(`%${textQuery}%`); // $10 - text pattern
    textFilter = `AND (LOWER(title) LIKE $10 OR LOWER(location_name) LIKE $10 OR LOWER(COALESCE(description, '')) LIKE $10)`;
  }

  const sortClause = getSortClause(sortBy);

  values.push(limit);  // $N-1 - limit
  values.push(offset); // $N   - offset
  const limitParam = `$${values.length - 1}`;
  const offsetParam = `$${values.length}`;

  const query = `
    WITH geo_candidates AS (
      SELECT *
      FROM spaces
      WHERE lat BETWEEN $1 AND $2
        AND lon BETWEEN $3 AND $4
    )
    SELECT
      id, title, description, location_name, lat, lon,
      price_per_hour, capacity, owner_id, image_urls, created_at,
      ((lat - $5) * (lat - $5) + (lon - $6) * (lon - $6)) AS dist_sq
    FROM geo_candidates
    WHERE price_per_hour BETWEEN $7 AND $8
      AND capacity >= $9
      ${textFilter}
    ORDER BY ${sortClause}
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const result = await db.query(query, values);
  const spaces = result.rows;

  // Cache result
  await redis.set(key, JSON.stringify(spaces), 'EX', ttl);
  return { source: 'db', spaces };
}

module.exports = { searchSpaces };
