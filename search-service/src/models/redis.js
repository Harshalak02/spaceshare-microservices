const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', () => console.log('✅ [search-service] Redis connected'));
redis.on('error', (err) => console.error('❌ [search-service] Redis error:', err.message));

module.exports = redis;
