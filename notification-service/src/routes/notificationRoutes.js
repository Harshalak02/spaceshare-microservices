const express = require('express');
const { getByUser } = require('../controllers/notificationController');

const router = express.Router();

router.get('/notifications/user/:userId', getByUser);

module.exports = router;
