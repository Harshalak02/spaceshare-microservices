require('dotenv').config();
const app = require('./src/app');
const Redis = require('ioredis');
const bookingService = require('./src/services/bookingService');
const { startOutboxPoller } = require('./src/services/outboxPublisher');

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

// ──────────────────────────────────────────────────────────
// Fix 2: Re-enable stale pending booking cleanup.
// Abandoned pending bookings (past their payment window)
// permanently block slots. This background job cleans them
// with jitter to prevent thundering-herd across instances.
// ──────────────────────────────────────────────────────────
if (STALE_PENDING_CLEANUP_INTERVAL_MS > 0) {
	// Add initial jitter (0-5 seconds) so multiple instances don't all clean at the same time
	const initialJitterMs = Math.floor(Math.random() * 5000);
	setTimeout(() => {
		setInterval(async () => {
			try {
				const deleted = await bookingService.cleanupStalePendingBookings();
				if (deleted.length > 0) {
					console.log(`✅ [booking-service] Cleaned ${deleted.length} stale pending booking(s)`);
				}
			} catch (error) {
				console.error('❌ [booking-service] Stale booking cleanup failed:', error.message);
			}
		}, STALE_PENDING_CLEANUP_INTERVAL_MS);
	}, initialJitterMs);

	console.log(`✅ [booking-service] Stale cleanup scheduled (interval=${STALE_PENDING_CLEANUP_INTERVAL_MS}ms, jitter=${initialJitterMs}ms)`);
}

// ──────────────────────────────────────────────────────────
// Fix 8: Start the outbox poller for reliable event delivery.
// Events written to the outbox table during booking transactions
// are published to Redis pub/sub by this background poller.
// ──────────────────────────────────────────────────────────
startOutboxPoller();

app.listen(PORT, () => console.log(`Booking service running on ${PORT}`));
