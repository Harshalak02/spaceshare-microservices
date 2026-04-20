const express = require('express');
const { health } = require('../controllers/healthController');

const router = express.Router();
router.get('/health', health);
router.get('/events', async (req, res) => {
    try {
        const { getEvents } = require('../services/analyticsService');
        const events = await getEvents();
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: 'Failed to get events', error: error.message });
    }
});

module.exports = router;
