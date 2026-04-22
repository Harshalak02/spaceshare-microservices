require('dotenv').config();
const app = require('./src/app');
const Redis = require('ioredis');
const bookingService = require('./src/services/bookingService');

const PORT = process.env.PORT || 4004;

// Set up Redis subscriber for PAYMENT_SUCCESS
const subscriber = new Redis(process.env.REDIS_URL);
subscriber.subscribe('events', (err) => {
    if (err) console.error('❌ [booking-service] Subscriber error:', err);
});

subscriber.on('message', async (channel, message) => {
    try {
        const event = JSON.parse(message);
        if (event.type === 'PAYMENT_SUCCESS') {
            const { booking_id } = event.payload;
            console.log(`✅ [booking-service] Received PAYMENT_SUCCESS for booking ${booking_id}`);
            await bookingService.updateBookingStatus(booking_id, 'confirmed');
        }
    } catch (err) {
        console.error('❌ [booking-service] Failed to process event:', err.message);
    }
});

app.listen(PORT, () => console.log(`Booking service running on ${PORT}`));
