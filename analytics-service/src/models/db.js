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
        console.error('❌ [analytics-service] Failed to set DB timezone to UTC:', error.message);
    }
});

pool.connect()
    .then(async (client) => {
        console.log('✅ [analytics-service] PostgreSQL connected');
        const schemaPath = path.join(__dirname, '..', '..', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf-8');
            await client.query(schema);
            console.log('✅ [analytics-service] Schema initialized');
        }
        client.release();
    })
    .catch((err) => console.error('❌ [analytics-service] PostgreSQL connection failed:', err.message));

module.exports = pool;
