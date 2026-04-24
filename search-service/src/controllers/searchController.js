const redis = require('../models/redis');
const { searchSpaces } = require('../services/searchService');

async function search(req, res) {
  try {
    if (!req.query.lat || !req.query.lon) {
      return res.status(400).json({ message: 'lat and lon are required' });
    }

    // Pass through all query params — the service handles defaults/validation
    const params = {
      lat: req.query.lat,
      lon: req.query.lon,
      radiusKm: req.query.radiusKm || req.query.radius,
      min_price: req.query.min_price,
      max_price: req.query.max_price,
      capacity: req.query.capacity,
      q: req.query.q,
      sort_by: req.query.sort_by,
      page: req.query.page,
      limit: req.query.limit
    };

    const result = await searchSpaces(params);

    // Publish analytics event
    await redis.publish('events', JSON.stringify({
      type: 'SEARCH_PERFORMED',
      timestamp: new Date().toISOString(),
      payload: params
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
}

module.exports = { search };
