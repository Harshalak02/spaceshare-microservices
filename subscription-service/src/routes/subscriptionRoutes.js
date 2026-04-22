const express = require('express');
const controller = require('../controllers/subscriptionController');

const router = express.Router();
router.get('/plans', controller.getPlans);
router.post('/subscribe', controller.create);
router.get('/subscription/:user_id', controller.get);
router.get('/subscription/:user_id/active', controller.checkActive);
router.get('/me/:userId', controller.getUserSubscription);
module.exports = router;
