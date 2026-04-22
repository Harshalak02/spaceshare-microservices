const listingService = require('../services/listingService');

const AMENITIES = [
  { key: 'wifi', label: 'Wi-Fi' },
  { key: 'parking', label: 'Parking' },
  { key: 'ac', label: 'Air Conditioning' },
  { key: 'projector', label: 'Projector' },
  { key: 'coffee', label: 'Coffee' }
];

function toBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

async function getOwnedSpace(spaceId, userId) {
  const space = await listingService.getSpace(spaceId);
  if (!space) return { error: 'not_found' };
  if (space.owner_id !== userId) return { error: 'forbidden' };
  return { space };
}

async function create(req, res) {
  try {
    const { title, description, location_name, lat, lon, price_per_hour, capacity, timezone } = req.body;

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
      title, description, location_name, lat, lon, price_per_hour, capacity, timezone,
      owner_id: req.user.userId
    });
    res.status(201).json(space);
  } catch (error) {
    if (error && error.code === 'NO_SUBSCRIPTION') {
      return res.status(error.status || 402).json({
        message: error.message,
        code: 'NO_SUBSCRIPTION'
      });
    }
    if (error && error.code === 'PLAN_LIMIT_REACHED') {
      return res.status(error.status || 403).json({
        message: error.message,
        code: 'PLAN_LIMIT_REACHED'
      });
    }
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

async function getAmenities(req, res) {
  res.json(AMENITIES);
}

async function autocomplete(req, res) {
  try {
    const query = String(req.query.q || '').trim().toLowerCase();
    if (!query) return res.json([]);

    const spaces = await listingService.getAllSpaces();
    const names = [...new Set(
      spaces
        .map((space) => space.location_name)
        .filter(Boolean)
        .filter((name) => String(name).toLowerCase().includes(query))
    )];

    res.json(names.slice(0, 8).map((name, index) => ({ id: index + 1, name })));
  } catch (error) {
    res.status(500).json({ message: 'Failed to autocomplete locations', error: error.message });
  }
}

async function reverseGeocode(req, res) {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ message: 'lat and lon query params are required' });
    }

    const spaces = await listingService.getAllSpaces();
    const candidates = spaces.filter((space) => (
      Number.isFinite(Number(space.lat))
      && Number.isFinite(Number(space.lon))
      && Boolean(space.location_name)
    ));

    if (candidates.length === 0) {
      return res.json({ location_name: `${lat.toFixed(4)}, ${lon.toFixed(4)}` });
    }

    let nearest = candidates[0];
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const space of candidates) {
      const dLat = Number(space.lat) - lat;
      const dLon = Number(space.lon) - lon;
      const distance = (dLat * dLat) + (dLon * dLon);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = space;
      }
    }

    res.json({
      location_name: nearest.location_name,
      lat: Number(nearest.lat),
      lon: Number(nearest.lon)
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reverse geocode location', error: error.message });
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

    const { title, description, location_name, lat, lon, price_per_hour, capacity, timezone } = req.body;
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
      capacity: capacity != null ? capacity : space.capacity,
      timezone: timezone != null ? timezone : space.timezone
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

async function getWeeklyAvailability(req, res) {
  try {
    const { error, space } = await getOwnedSpace(req.params.id, req.user.userId);
    if (error === 'not_found') return res.status(404).json({ message: 'Space not found' });
    if (error === 'forbidden') return res.status(403).json({ message: 'You are not the owner of this space' });

    const week = await listingService.getWeeklyAvailability(req.params.id);
    res.json({
      space_id: Number(req.params.id),
      timezone: space.timezone,
      slot_minutes: space.slot_minutes,
      week
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get weekly availability', error: error.message });
  }
}

async function upsertWeeklyAvailability(req, res) {
  try {
    const { error } = await getOwnedSpace(req.params.id, req.user.userId);
    if (error === 'not_found') return res.status(404).json({ message: 'Space not found' });
    if (error === 'forbidden') return res.status(403).json({ message: 'You are not the owner of this space' });

    const { timezone, week } = req.body;
    if (!Array.isArray(week) || week.length === 0) {
      return res.status(400).json({ message: 'week is required and must be a non-empty array' });
    }

    const result = await listingService.upsertWeeklyAvailability(req.params.id, { timezone, week });
    res.json({ message: 'Weekly availability updated', ...result });
  } catch (error) {
    res.status(400).json({ message: 'Failed to update weekly availability', error: error.message });
  }
}

async function getAvailabilityOverrides(req, res) {
  try {
    const { error } = await getOwnedSpace(req.params.id, req.user.userId);
    if (error === 'not_found') return res.status(404).json({ message: 'Space not found' });
    if (error === 'forbidden') return res.status(403).json({ message: 'You are not the owner of this space' });

    const overrides = await listingService.getAvailabilityOverrides(req.params.id, req.query.from, req.query.to);
    res.json({ space_id: Number(req.params.id), overrides });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get overrides', error: error.message });
  }
}

async function upsertAvailabilityOverride(req, res) {
  try {
    const { error } = await getOwnedSpace(req.params.id, req.user.userId);
    if (error === 'not_found') return res.status(404).json({ message: 'Space not found' });
    if (error === 'forbidden') return res.status(403).json({ message: 'You are not the owner of this space' });

    const { date_local, closed_all_day, open_time_local, close_time_local, note } = req.body;
    if (!date_local) {
      return res.status(400).json({ message: 'date_local is required' });
    }

    const override = await listingService.upsertAvailabilityOverride(req.params.id, {
      date_local,
      closed_all_day: toBoolean(closed_all_day),
      open_time_local,
      close_time_local,
      note
    });

    res.json({ message: 'Override saved', override });
  } catch (error) {
    res.status(400).json({ message: 'Failed to save override', error: error.message });
  }
}

async function deleteAvailabilityOverride(req, res) {
  try {
    const { error } = await getOwnedSpace(req.params.id, req.user.userId);
    if (error === 'not_found') return res.status(404).json({ message: 'Space not found' });
    if (error === 'forbidden') return res.status(403).json({ message: 'You are not the owner of this space' });

    await listingService.deleteAvailabilityOverride(req.params.id, req.params.overrideId);
    res.json({ message: 'Override deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete override', error: error.message });
  }
}

async function getSlots(req, res) {
  try {
    const { from, to, include_unavailable } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: 'from and to query params are required (YYYY-MM-DD)' });
    }

    const payload = await listingService.getSlots(req.params.id, {
      from,
      to,
      includeUnavailable: toBoolean(include_unavailable)
    });

    res.json(payload);
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ message: 'Failed to get slots', error: error.message });
  }
}

module.exports = {
  create,
  getById,
  getAll,
  getAmenities,
  autocomplete,
  reverseGeocode,
  getMy,
  update,
  remove,
  getWeeklyAvailability,
  upsertWeeklyAvailability,
  getAvailabilityOverrides,
  upsertAvailabilityOverride,
  deleteAvailabilityOverride,
  getSlots
};
