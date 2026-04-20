const redis = require('../models/redis');
const { searchSpaces } = require('../services/searchService');

async function search(req, res) {
  try {
    if (!req.query.lat || !req.query.lon) {
      return res.status(400).json({ message: 'lat and lon are required' });
    }

    const result = await searchSpaces(req.query);

    // Publish analytics event
    await redis.publish('events', JSON.stringify({
      type: 'SEARCH_PERFORMED',
      timestamp: new Date().toISOString(),
      payload: req.query
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
}

module.exports = { search };
