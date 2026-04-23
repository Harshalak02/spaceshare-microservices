const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
const fs = require('fs');
const path = require('path');

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DB_URL });

pool.on('connect', async (client) => {
    try {
        await client.query("SET TIME ZONE 'UTC'");
    } catch (error) {
        console.error('❌ [listing-service] Failed to set DB timezone to UTC:', error.message);
    }
});

pool.connect()
    .then(async (client) => {
        console.log('✅ [listing-service] PostgreSQL connected');
        const schemaPath = path.join(__dirname, '..', '..', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf-8');
            await client.query(schema);
            console.log('✅ [listing-service] Schema initialized');
        }
        client.release();
    })
    .catch((err) => console.error('❌ [listing-service] PostgreSQL connection failed:', err.message));

module.exports = pool;
