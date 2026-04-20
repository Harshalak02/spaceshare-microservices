const express = require('express');
const controller = require('../controllers/bookingController');

const router = express.Router();
router.post('/book', controller.create);
router.get('/bookings/:user_id', controller.getByUser);

module.exports = router;
