const express = require('express');
const { register, login, validateToken, getUser } = require('../controllers/authController');

const router = express.Router();
router.post('/register', register);
router.post('/login', login);
router.get('/validate-token', validateToken);
router.get('/users/:id', getUser);

module.exports = router;
