const listingService = require('../services/listingService');

async function create(req, res) {
  try {
    const { title, description, location_name, lat, lon, price_per_hour, capacity } = req.body;

    // Validation
    if (!title || lat == null || lon == null || price_per_hour == null || capacity == null) {
      return res.status(400).json({ message: 'title, lat, lon, price_per_hour, and capacity are required' });
    }
    if (Number(capacity) <= 0) {
      return res.status(400).json({ message: 'capacity must be greater than 0' });
    }
    if (Number(price_per_hour) <= 0) {
      return res.status(400).json({ message: 'price_per_hour must be greater than 0' });
    }

    const space = await listingService.createSpace({
      title, description, location_name, lat, lon, price_per_hour, capacity,
      owner_id: req.user.userId
    });
    res.status(201).json(space);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create space', error: error.message });
  }
}

async function getById(req, res) {
  try {
    const space = await listingService.getSpace(req.params.id);
    if (!space) return res.status(404).json({ message: 'Space not found' });
    res.json(space);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get space', error: error.message });
  }
}

async function getAll(req, res) {
  try {
    const spaces = await listingService.getAllSpaces();
    res.json(spaces);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get spaces', error: error.message });
  }
}

async function getMy(req, res) {
  try {
    const spaces = await listingService.getSpacesByOwner(req.user.userId);
    res.json(spaces);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get your spaces', error: error.message });
  }
}

async function update(req, res) {
  try {
    const space = await listingService.getSpace(req.params.id);
    if (!space) return res.status(404).json({ message: 'Space not found' });
    if (space.owner_id !== req.user.userId) {
      return res.status(403).json({ message: 'You are not the owner of this space' });
    }

    const { title, description, location_name, lat, lon, price_per_hour, capacity } = req.body;
    if (capacity != null && Number(capacity) <= 0) {
      return res.status(400).json({ message: 'capacity must be greater than 0' });
    }
    if (price_per_hour != null && Number(price_per_hour) <= 0) {
      return res.status(400).json({ message: 'price_per_hour must be greater than 0' });
    }

    const updated = await listingService.updateSpace(req.params.id, {
      title: title || space.title,
      description: description !== undefined ? description : space.description,
      location_name: location_name !== undefined ? location_name : space.location_name,
      lat: lat != null ? lat : space.lat,
      lon: lon != null ? lon : space.lon,
      price_per_hour: price_per_hour != null ? price_per_hour : space.price_per_hour,
      capacity: capacity != null ? capacity : space.capacity
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update space', error: error.message });
  }
}

async function remove(req, res) {
  try {
    const space = await listingService.getSpace(req.params.id);
    if (!space) return res.status(404).json({ message: 'Space not found' });
    if (space.owner_id !== req.user.userId) {
      return res.status(403).json({ message: 'You are not the owner of this space' });
    }

    await listingService.deleteSpace(req.params.id);
    res.json({ message: 'Space deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete space', error: error.message });
  }
}

module.exports = { create, getById, getAll, getMy, update, remove };
