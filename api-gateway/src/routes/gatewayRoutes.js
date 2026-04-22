const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { forwardRequest } = require('../services/proxyService');

const router = express.Router();

// Public routes (no auth needed)
router.use('/auth', (req, res) => forwardRequest(process.env.AUTH_SERVICE_URL, req, res));
router.use('/search', (req, res) => {
	const targetPath = req.path === '/spaces' ? '/' : req.path;
	return forwardRequest(process.env.SEARCH_SERVICE_URL, req, res, { targetPath });
});

// Protected routes (auth required)
router.use('/listings', authMiddleware, (req, res) => forwardRequest(process.env.LISTING_SERVICE_URL, req, res));
router.use('/bookings', authMiddleware, (req, res) => forwardRequest(process.env.BOOKING_SERVICE_URL, req, res));
router.use('/payments', authMiddleware, (req, res) => forwardRequest(process.env.PAYMENT_SERVICE_URL, req, res));
router.use('/notifications', authMiddleware, (req, res) => {
	let targetPath = req.path;
	if (req.method === 'GET' && req.path === '/my') {
		targetPath = `/notifications/user/${req.user.userId}`;
	}

	return forwardRequest(process.env.NOTIFICATION_SERVICE_URL, req, res, { targetPath });
});
router.use('/subscriptions', authMiddleware, (req, res) => {
	const userId = req.user?.userId;
	let targetPath = req.path;
	let body = req.body;

	if (req.method === 'GET' && req.path === '/my') {
		targetPath = `/subscription/${userId}`;
	}

	if (req.method === 'GET' && req.path === '/my/active') {
		targetPath = `/subscription/${userId}/active`;
	}

	if (req.method === 'POST' && req.path === '/subscribe') {
		body = {
			...req.body,
			user_id: req.body?.user_id || userId
		};
	}

	return forwardRequest(process.env.SUBSCRIPTION_SERVICE_URL, req, res, {
		targetPath,
		body
	});
});

module.exports = router;
