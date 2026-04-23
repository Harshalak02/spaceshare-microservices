const db = require('../models/db');
const redis = require('../models/redis');

function normalizeImageUrls(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  return [];
}

async function upsertSpace(space) {
  if (!space || !space.id) return;

  const imageUrls = normalizeImageUrls(space.image_urls);

  await db.query(
    `INSERT INTO spaces (id, title, description, location_name, lat, lon, price_per_hour, capacity, owner_id, image_urls, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
     ON CONFLICT (id)
     DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      location_name = EXCLUDED.location_name,
      lat = EXCLUDED.lat,
      lon = EXCLUDED.lon,
      price_per_hour = EXCLUDED.price_per_hour,
      capacity = EXCLUDED.capacity,
      owner_id = EXCLUDED.owner_id,
      image_urls = EXCLUDED.image_urls,
      created_at = EXCLUDED.created_at`,
    [
      space.id,
      space.title,
      space.description || '',
      space.location_name || '',
      space.lat,
      space.lon,
      space.price_per_hour,
      space.capacity,
      space.owner_id || null,
      JSON.stringify(imageUrls),
      space.created_at || new Date().toISOString()
    ]
  );
}

async function removeSpace(id) {
  if (!id) return;
  await db.query('DELETE FROM spaces WHERE id = $1', [id]);
}

async function handleListingEvent(message) {
  let event;

  try {
    event = JSON.parse(message);
  } catch {
    return;
  }

  try {
    if (event.type === 'LISTING_CREATED' || event.type === 'LISTING_UPDATED') {
      await upsertSpace(event.payload?.space);
    }

    if (event.type === 'LISTING_DELETED') {
      await removeSpace(event.payload?.id);
    }
  } catch (error) {
    console.error('❌ [search-service] Failed to process listing event:', error.message);
  }
}

async function startListingSyncSubscriber() {
  const subscriber = redis.duplicate();

  subscriber.on('error', (err) => {
    console.error('❌ [search-service] Listing sync subscriber error:', err.message);
  });

  await subscriber.subscribe('events');

  subscriber.on('message', (channel, message) => {
    if (channel !== 'events') return;
    handleListingEvent(message);
  });

  console.log('✅ [search-service] Listening for listing sync events');
}

module.exports = { startListingSyncSubscriber };
