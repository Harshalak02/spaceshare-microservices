const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { forwardRequest } = require('../services/proxyService');

const router = express.Router();

// Public routes (no auth needed)
router.use('/auth', (req, res) => forwardRequest(process.env.AUTH_SERVICE_URL, req, res));
router.use('/search', (req, res) => forwardRequest(process.env.SEARCH_SERVICE_URL, req, res));

// Protected routes (auth required)
router.use('/listings', authMiddleware, (req, res) => forwardRequest(process.env.LISTING_SERVICE_URL, req, res));
router.use('/bookings', authMiddleware, (req, res) => forwardRequest(process.env.BOOKING_SERVICE_URL, req, res));
router.use('/subscriptions', authMiddleware, (req, res) => forwardRequest(process.env.SUBSCRIPTION_SERVICE_URL, req, res));

module.exports = router;
