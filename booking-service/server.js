require('dotenv').config();
const app = require('./src/app');
const Redis = require('ioredis');
const bookingService = require('./src/services/bookingService');

const PORT = process.env.PORT || 4004;
const STALE_PENDING_CLEANUP_INTERVAL_MS = Number(process.env.STALE_PENDING_CLEANUP_INTERVAL_MS || 30000);

const subscriber = new Redis(process.env.REDIS_URL);

subscriber.on('connect', () => console.log('✅ [booking-service] Redis subscriber connected'));
subscriber.on('error', (err) => console.error('❌ [booking-service] Redis subscriber error:', err.message));

subscriber.subscribe('events', () => {
	console.log('✅ [booking-service] Subscribed to events channel');
});

subscriber.on('message', async (_channel, message) => {
	try {
		const event = JSON.parse(message);
		if (event.type !== 'PAYMENT_SUCCESS') return;

		const bookingId = Number(event.payload?.booking_id);
		if (!Number.isInteger(bookingId) || bookingId <= 0) return;

		const updated = await bookingService.updateBookingStatus(
			bookingId,
			'confirmed',
			0,
			'Payment succeeded'
		);
		if (updated) {
			console.log(`✅ [booking-service] PAYMENT_SUCCESS processed for booking ${bookingId}`);
		}
	} catch (error) {
		console.error('❌ [booking-service] Failed to process payment event:', error.message);
	}
});

// if (STALE_PENDING_CLEANUP_INTERVAL_MS > 0) {
// 	setInterval(async () => {
// 		try {
// 			const deleted = await bookingService.cleanupStalePendingBookings();
// 			if (deleted.length > 0) {
// 				console.log(`✅ [booking-service] Cleaned ${deleted.length} stale pending booking(s)`);
// 			}
// 		} catch (error) {
// 			console.error('❌ [booking-service] Stale booking cleanup failed:', error.message);
// 		}
// 	}, STALE_PENDING_CLEANUP_INTERVAL_MS);
// }

app.listen(PORT, () => console.log(`Booking service running on ${PORT}`));
