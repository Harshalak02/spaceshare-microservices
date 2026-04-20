const db = require('../models/db');

async function createSpace(data) {
  const { title, lat, lon, price_per_hour, capacity, owner_id, amenities = [] } = data;
  const result = await db.query(
    'INSERT INTO spaces (title, lat, lon, price_per_hour, capacity, owner_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [title, lat, lon, price_per_hour, capacity, owner_id]
  );
  const space = result.rows[0];

  for (const amenityId of amenities) {
    await db.query('INSERT INTO space_amenities (space_id, amenity_id) VALUES ($1, $2)', [space.id, amenityId]);
  }

  return space;
}

async function getSpace(id) {
  const spaceRes = await db.query('SELECT * FROM spaces WHERE id = $1', [id]);
  if (!spaceRes.rows[0]) return null;
  const amenitiesRes = await db.query(
    'SELECT a.* FROM amenities a JOIN space_amenities sa ON a.id = sa.amenity_id WHERE sa.space_id = $1',
    [id]
  );
  return { ...spaceRes.rows[0], amenities: amenitiesRes.rows };
}

async function updateSpace(id, data) {
  const { title, lat, lon, price_per_hour, capacity } = data;
  const result = await db.query(
    'UPDATE spaces SET title=$1, lat=$2, lon=$3, price_per_hour=$4, capacity=$5 WHERE id=$6 RETURNING *',
    [title, lat, lon, price_per_hour, capacity, id]
  );
  return result.rows[0];
}

async function deleteSpace(id) {
  await db.query('DELETE FROM space_amenities WHERE space_id=$1', [id]);
  await db.query('DELETE FROM spaces WHERE id=$1', [id]);
}

module.exports = { createSpace, getSpace, updateSpace, deleteSpace };
