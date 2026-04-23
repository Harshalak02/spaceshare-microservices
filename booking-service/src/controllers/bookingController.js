const service = require('../services/bookingService');
const { parseUtcInput } = require('../utils/dateTime');

async function create(req, res) {
  try {
    const { space_id, start_slot_utc, slot_count, guest_count, idempotency_key, start_time, end_time } = req.body;

    // Backward compatibility: if caller still sends start_time/end_time, translate to slot fields.
    let resolvedStartSlotUtc = start_slot_utc;
    let resolvedSlotCount = slot_count;
    if (!resolvedStartSlotUtc && start_time && end_time) {
      const start = parseUtcInput(start_time, 'start_time');
      const end = parseUtcInput(end_time, 'end_time');
      if (end <= start) {
        return res.status(400).json({ message: 'Invalid start_time/end_time range' });
      }
      resolvedStartSlotUtc = start.toISOString();
      resolvedSlotCount = Math.round((end.getTime() - start.getTime()) / (60 * 60 * 1000));
    }

    if (!space_id || !resolvedStartSlotUtc || !resolvedSlotCount) {
      return res.status(400).json({
        message: 'space_id, start_slot_utc, and slot_count are required (or provide start_time/end_time)'
      });
    }

    const booking = await service.createBooking({
      space_id,
      user_id: req.user.userId,
      start_slot_utc: resolvedStartSlotUtc,
      slot_count: resolvedSlotCount,
      guest_count,
      idempotency_key
    });
    res.status(201).json(booking);
  } catch (error) {
    const status =
      error.message.includes('already booked') ? 409 :
      error.message.includes('not found') ? 404 :
      error.message.includes('invalid') || error.message.includes('required') || error.message.includes('Guest') || error.message.includes('timezone') ? 400 :
      500;
    res.status(status).json({ message: error.message });
  }
}

async function getMy(req, res) {
  try {
    const bookings = await service.getBookingsByUser(req.user.userId);
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get bookings', error: error.message });
  }
}

async function getByUser(req, res) {
  try {
    const requestedUserId = Number(req.params.user_id);
    const requesterId = Number(req.user.userId);
    const role = req.user.role;

    if (role !== 'admin' && requesterId !== requestedUserId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const bookings = await service.getBookingsByUser(req.params.user_id);
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get bookings', error: error.message });
  }
}

async function getHostMy(req, res) {
  try {
    const bookings = await service.getBookingsByHost(req.user.userId);
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get host bookings', error: error.message });
  }
}

async function cancel(req, res) {
  try {
    const bookingId = Number(req.params.booking_id);
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ message: 'Invalid booking_id' });
    }

    const cancelled = await service.cancelBooking(
      bookingId,
      req.user.userId,
      req.user.role,
      req.body?.reason
    );

    res.json(cancelled);
  } catch (error) {
    const status =
      error.message === 'Booking not found' ? 404 :
      error.message === 'Forbidden' ? 403 :
      error.message.includes('cannot be cancelled') ? 409 :
      500;
    res.status(status).json({ message: error.message });
  }
}

async function getReservedSlots(req, res) {
  try {
    const spaceId = Number(req.params.space_id);
    const { from, to } = req.query;

    if (!Number.isInteger(spaceId) || spaceId <= 0) {
      return res.status(400).json({ message: 'Invalid space_id' });
    }
    if (!from || !to) {
      return res.status(400).json({ message: 'from and to are required' });
    }

    const reservedSlots = await service.getReservedSlots(spaceId, String(from), String(to));
    res.json({
      listing_id: spaceId,
      from,
      to,
      reserved_slots: reservedSlots
    });
  } catch (error) {
    const status = error.message.includes('valid YYYY-MM-DD') ? 400 : 500;
    res.status(status).json({ message: error.message });
  }
}

module.exports = {
  create,
  getMy,
  getByUser,
  getHostMy,
  cancel,
  getReservedSlots
};
