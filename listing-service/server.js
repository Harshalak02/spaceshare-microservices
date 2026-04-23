require('dotenv').config();
const app = require('./src/app');
const Redis = require('ioredis');
const listingService = require('./src/services/listingService');

const PORT = process.env.PORT || 4002;

const subscriber = new Redis(process.env.REDIS_URL);

subscriber.on('connect', () => console.log('✅ [listing-service] Redis subscriber connected'));
subscriber.on('error', (err) => console.error('❌ [listing-service] Redis subscriber error:', err.message));

subscriber.subscribe('events', () => {
	console.log('✅ [listing-service] Subscribed to events channel');
});

subscriber.on('message', async (_channel, message) => {
	try {
		const event = JSON.parse(message);
		const invalidationEvents = new Set(['BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED']);
		if (!invalidationEvents.has(event.type)) return;

		const spaceId = Number(event.payload?.space_id);
		if (!Number.isInteger(spaceId) || spaceId <= 0) return;

		await listingService.invalidateSlotCache(spaceId);
		console.log(`✅ [listing-service] Invalidated slot cache for listing ${spaceId} on ${event.type}`);
	} catch (error) {
		console.error('❌ [listing-service] Failed to process event for slot cache invalidation:', error.message);
	}
});

app.listen(PORT, () => console.log(`Listing service running on ${PORT}`));
