const db = require('../models/db');

async function createSpace(data) {
  const { title, description, location_name, lat, lon, price_per_hour, capacity, owner_id } = data;
  const result = await db.query(
    `INSERT INTO spaces (title, description, location_name, lat, lon, price_per_hour, capacity, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [title, description || '', location_name || '', lat, lon, price_per_hour, capacity, owner_id]
  );
  return result.rows[0];
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
  const { title, description, location_name, lat, lon, price_per_hour, capacity } = data;
  const result = await db.query(
    `UPDATE spaces SET title=$1, description=$2, location_name=$3, lat=$4, lon=$5, price_per_hour=$6, capacity=$7
     WHERE id=$8 RETURNING *`,
    [title, description || '', location_name || '', lat, lon, price_per_hour, capacity, id]
  );
  return result.rows[0];
}

async function deleteSpace(id) {
  await db.query('DELETE FROM spaces WHERE id=$1', [id]);
}

module.exports = { createSpace, getSpace, getAllSpaces, getSpacesByOwner, updateSpace, deleteSpace };
