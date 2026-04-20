const service = require('../services/bookingService');

async function create(req, res) {
  try {
    const booking = await service.createBooking(req.body);
    res.status(201).json(booking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function getByUser(req, res) {
  const bookings = await service.getBookingsByUser(req.params.user_id);
  res.json(bookings);
}

module.exports = { create, getByUser };
