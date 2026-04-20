const express = require('express');
const controller = require('../controllers/subscriptionController');

const router = express.Router();
router.post('/subscribe', controller.create);
router.get('/subscription/:user_id', controller.get);

module.exports = router;
