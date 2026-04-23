const express = require('express');
const controller = require('../controllers/bookingController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

function internalServiceAuth(req, res, next) {
	const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;
	if (!expectedToken) {
		return next();
	}

	const token = req.header('X-Internal-Token');
	if (!token || token !== expectedToken) {
		return res.status(401).json({ message: 'Unauthorized internal call' });
	}
	return next();
}

// All booking routes require JWT
router.get('/bookings/my', authMiddleware, controller.getMy);
router.get('/bookings/host/my', authMiddleware, controller.getHostMy);
router.post('/book', authMiddleware, controller.create);
router.post('/bookings/:booking_id/cancel', authMiddleware, controller.cancel);
router.delete('/bookings/:booking_id/pending', authMiddleware, controller.deletePending);
router.delete('/:booking_id/pending', authMiddleware, controller.deletePending);
router.get('/bookings/:user_id', authMiddleware, controller.getByUser);

router.get(
	'/internal/listings/:space_id/reserved-slots',
	internalServiceAuth,
	controller.getReservedSlots
);

router.post(
	'/internal/bookings/:booking_id/confirm',
	internalServiceAuth,
	controller.confirmInternalPayment
);

module.exports = router;
