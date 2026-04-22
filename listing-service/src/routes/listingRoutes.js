const express = require('express');
const controller = require('../controllers/listingController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// /spaces/my MUST come before /spaces/:id to avoid route shadowing
router.get('/spaces/my', authMiddleware, controller.getMy);
router.get('/amenities', controller.getAmenities);
router.get('/autocomplete', controller.autocomplete);
router.get('/reverse', controller.reverseGeocode);
// Public routes
router.get('/spaces', controller.getAll);
router.get('/spaces/:id/slots', controller.getSlots);
router.get('/spaces/:id', controller.getById);

// Availability routes (owner only)
router.get('/spaces/:id/availability/weekly', authMiddleware, controller.getWeeklyAvailability);
router.put('/spaces/:id/availability/weekly', authMiddleware, controller.upsertWeeklyAvailability);
router.get('/spaces/:id/availability/overrides', authMiddleware, controller.getAvailabilityOverrides);
router.put('/spaces/:id/availability/overrides', authMiddleware, controller.upsertAvailabilityOverride);
router.delete('/spaces/:id/availability/overrides/:overrideId', authMiddleware, controller.deleteAvailabilityOverride);

// Protected routes (require JWT)
router.post('/spaces', authMiddleware, controller.create);
router.put('/spaces/:id', authMiddleware, controller.update);
router.delete('/spaces/:id', authMiddleware, controller.remove);

module.exports = router;
