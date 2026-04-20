const listingService = require('../services/listingService');

async function create(req, res) {
  try {
    const space = await listingService.createSpace(req.body);
    res.status(201).json(space);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create space', error: error.message });
  }
}

async function getById(req, res) {
  const space = await listingService.getSpace(req.params.id);
  if (!space) return res.status(404).json({ message: 'Space not found' });
  res.json(space);
}

async function update(req, res) {
  const updated = await listingService.updateSpace(req.params.id, req.body);
  res.json(updated);
}

async function remove(req, res) {
  await listingService.deleteSpace(req.params.id);
  res.json({ message: 'Deleted' });
}

module.exports = { create, getById, update, remove };
