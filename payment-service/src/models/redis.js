const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', () => console.log('✅ [payment-service] Redis connected'));
redis.on('error', (err) => console.error('❌ [payment-service] Redis error:', err.message));

module.exports = redis;
