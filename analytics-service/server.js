require('dotenv').config();
const app = require('./src/app');
const Redis = require('ioredis');
const { logEvent } = require('./src/services/analyticsService');

const PORT = process.env.PORT || 4007;
const subscriber = new Redis(process.env.REDIS_URL);

subscriber.subscribe('events', () => {
  console.log('Analytics service subscribed to events');
});

subscriber.on('message', async (channel, message) => {
  const event = JSON.parse(message);
  await logEvent(event);
  console.log(`[Analytics] Stored event ${event.type}`);
});

app.listen(PORT, () => console.log(`Analytics service running on ${PORT}`));
