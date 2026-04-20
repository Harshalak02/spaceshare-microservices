const express = require('express');
const controller = require('../controllers/bookingController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// All booking routes require JWT
router.get('/bookings/my', authMiddleware, controller.getMy);
router.post('/book', authMiddleware, controller.create);
router.get('/bookings/:user_id', controller.getByUser);

module.exports = router;
