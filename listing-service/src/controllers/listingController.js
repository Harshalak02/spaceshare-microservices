const fetch = require('node-fetch');
const listingService = require('../services/listingService');

function validateAmenitiesField(amenities) {
  return amenities === undefined || Array.isArray(amenities);
}

async function create(req, res) {
  try {
    const { title, description, location_name, lat, lon, price_per_hour, capacity, amenities } = req.body;

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
    if (!validateAmenitiesField(amenities)) {
      return res.status(400).json({ message: 'amenities must be an array' });
    }



    const space = await listingService.createSpace({
      title, description, location_name, lat, lon, price_per_hour, capacity, amenities,
      owner_id: req.user.userId
    });
    res.status(201).json(space);
  } catch (error) {
    if (error && error.code === 'NO_SUBSCRIPTION') {
      return res.status(error.status || 402).json({ message: error.message, code: 'NO_SUBSCRIPTION' });
    }
    if (error && error.code === 'PLAN_LIMIT_REACHED') {
      return res.status(error.status || 403).json({ message: error.message, code: 'PLAN_LIMIT_REACHED' });
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

    const { title, description, location_name, lat, lon, price_per_hour, capacity, amenities } = req.body;
    if (capacity != null && Number(capacity) <= 0) {
      return res.status(400).json({ message: 'capacity must be greater than 0' });
    }
    if (price_per_hour != null && Number(price_per_hour) <= 0) {
      return res.status(400).json({ message: 'price_per_hour must be greater than 0' });
    }
    if (!validateAmenitiesField(amenities)) {
      return res.status(400).json({ message: 'amenities must be an array' });
    }


    const updated = await listingService.updateSpace(req.params.id, {
      title: title || space.title,
      description: description !== undefined ? description : space.description,
      location_name: location_name !== undefined ? location_name : space.location_name,
      lat: lat != null ? lat : space.lat,
      lon: lon != null ? lon : space.lon,
      price_per_hour: price_per_hour != null ? price_per_hour : space.price_per_hour,
      capacity: capacity != null ? capacity : space.capacity,
      amenities: amenities !== undefined ? amenities : space.amenities
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update space', error: error.message });
  }
}
async function getAmenities(req, res) {
  try {
    const amenities = await listingService.getAllAmenities();
    res.json(amenities);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch amenities', error: error.message });
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
async function autocomplete(req, res) {
  try {
    const q = req.query.q;
    if (!q) return res.json([]);

    console.log("🔍 Query:", q);  // ADD

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=in`,
      {
        headers: {
          "User-Agent": "spaceshare-app"
        }
      }
    );

    console.log("🌐 Status:", response.status); // ADD

    const data = await response.json();

    console.log("✅ Data received:", data.length); // ADD

    res.json(data);

  } catch (err) {
    console.error("❌ Autocomplete error FULL:", err); // IMPORTANT
    res.status(500).json({ message: "Autocomplete failed" });
  }
}




// async function autocomplete(req, res) {
//   try {
//     let q = req.query.q;

//     if (!q) return res.json([]);

//     // ✅ CLEAN INPUT (IMPORTANT)
//     q = q.trim().replace(/\s+/g, ' ');

//     const response = await fetch(
//       `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=in`,
//       {
//         headers: {
//           "User-Agent": "spaceshare-app"
//         }
//       }
//     );

//     // ✅ HANDLE NON-200 (VERY IMPORTANT)
//     if (!response.ok) {
//       console.error("❌ Nominatim failed:", response.status);
//       return res.json([]); // don't crash
//     }

//     // ✅ SAFE JSON PARSE
//     let data = [];
//     try {
//       data = await response.json();
//     } catch (e) {
//       console.error("❌ JSON parse failed");
//       return res.json([]);
//     }

//     res.json(data);

//   } catch (err) {
//     console.error("❌ Autocomplete error:", err);
//     res.json([]); // NEVER send 500 for autocomplete
//   }
// }
async function reverseGeocode(req, res) {
  try {
    const { lat, lon } = req.query;

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      {
        headers: {
          "User-Agent": "spaceshare-app"
        }
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Reverse geocode failed" });
  }
}
module.exports = { create, getById, getAll, getMy, update, remove, getAmenities, autocomplete, reverseGeocode };