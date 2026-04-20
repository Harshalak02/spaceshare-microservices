const express = require('express');
const controller = require('../controllers/listingController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// /spaces/my MUST come before /spaces/:id to avoid route shadowing
router.get('/spaces/my', authMiddleware, controller.getMy);

// Public routes
router.get('/spaces', controller.getAll);
router.get('/spaces/:id', controller.getById);

// Protected routes (require JWT)
router.post('/spaces', authMiddleware, controller.create);
router.put('/spaces/:id', authMiddleware, controller.update);
router.delete('/spaces/:id', authMiddleware, controller.remove);

module.exports = router;
