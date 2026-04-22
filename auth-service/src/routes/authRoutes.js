const express = require('express');
const { register, login, validateToken } = require('../controllers/authController');

const router = express.Router();
router.post('/register', register);
router.post('/login', login);
router.get('/validate-token', validateToken);
router.get('/users/:id', require('../controllers/authController').getUser);

module.exports = router;
