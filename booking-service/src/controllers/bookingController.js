const service = require('../services/bookingService');

async function create(req, res) {
  try {
    const { space_id, start_time, end_time } = req.body;

    if (!space_id || !start_time || !end_time) {
      return res.status(400).json({ message: 'space_id, start_time, and end_time are required' });
    }

    const booking = await service.createBooking({
      space_id,
      user_id: req.user.userId,
      start_time,
      end_time
    });
    res.status(201).json(booking);
  } catch (error) {
    console.error('❌ [booking] create error:', error.message, error.stack);
    const status = error.message.includes('already booked') ? 409 : 500;
    res.status(status).json({ message: error.message });
  }
}

async function getMy(req, res) {
  try {
    const bookings = await service.getBookingsByUser(req.user.userId);
    res.json(bookings);
  } catch (error) {
    console.error('❌ [booking] getMy error:', error.message, error.stack);
    res.status(500).json({ message: 'Failed to get bookings', error: error.message });
  }
}

async function getByUser(req, res) {
  try {
    const bookings = await service.getBookingsByUser(req.params.user_id);
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get bookings', error: error.message });
  }
}

module.exports = { create, getMy, getByUser };
