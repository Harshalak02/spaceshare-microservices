require('dotenv').config();
const app = require('./src/app');
const Redis = require('ioredis');
const { handleEvent } = require('./src/services/notificationService');

const PORT = process.env.PORT || 4006;
const subscriber = new Redis(process.env.REDIS_URL);

subscriber.on('connect', () => console.log('✅ [notification-service] Redis connected'));
subscriber.on('error', (err) => console.error('❌ [notification-service] Redis error:', err.message));

subscriber.subscribe('events', () => {
  console.log('Notification service subscribed to events');
});

subscriber.on('message', (channel, message) => {
  const event = JSON.parse(message);
  if (event.type === 'BOOKING_CONFIRMED' || event.type === 'SUBSCRIPTION_EXPIRED') {
    handleEvent(event);
  }
});

app.listen(PORT, () => console.log(`Notification service running on ${PORT}`));
