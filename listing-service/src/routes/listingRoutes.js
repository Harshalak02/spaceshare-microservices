const express = require('express');
const controller = require('../controllers/listingController');

const router = express.Router();
router.post('/spaces', controller.create);
router.get('/spaces/:id', controller.getById);
router.put('/spaces/:id', controller.update);
router.delete('/spaces/:id', controller.remove);

module.exports = router;
