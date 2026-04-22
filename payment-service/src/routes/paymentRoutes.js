const express = require('express');
const controller = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');
const internalAuthMiddleware = require('../middleware/internalAuthMiddleware');

const router = express.Router();

// Payment endpoints
router.post('/create-session', authMiddleware, controller.createSession);
router.post('/simulate-success', authMiddleware, controller.simulateSuccess); // For mock tests
router.post('/webhook', express.raw({type: 'application/json'}), controller.webhook);
router.post('/internal/charge', internalAuthMiddleware, controller.internalCharge);

module.exports = router;
