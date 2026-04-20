const jwt = require('jsonwebtoken');
const { registerUser, loginUser } = require('../services/authService');

async function register(req, res) {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
    const user = await registerUser(email, password, role);
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    if (!result) return res.status(401).json({ message: 'Invalid credentials' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
}

function validateToken(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ valid: false });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, user: payload });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
}

module.exports = { register, login, validateToken };
