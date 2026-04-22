const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../models/db');

async function registerUser(email, password, role = 'guest') {
  const hash = await bcrypt.hash(password, 10);
  const query = 'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role';
  const result = await db.query(query, [email, hash, role]);
  return result.rows[0];
}

async function loginUser(email, password) {
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (!result.rows[0]) return null;

  const user = result.rows[0];
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) return null;

  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '1d'
  });

  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

async function getUserById(id) {
  const result = await db.query('SELECT id, email, role FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

module.exports = { registerUser, loginUser, getUserById };
