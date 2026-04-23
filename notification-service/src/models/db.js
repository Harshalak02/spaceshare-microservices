const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
const fs = require('fs');
const path = require('path');

// Crucial step: Tells Neon to use WebSockets to bypass port 5432
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DB_URL });

pool.on('connect', async (client) => {
  try {
    await client.query("SET TIME ZONE 'UTC'");
  } catch (error) {
    console.error('❌ [notification-service] Failed to set DB timezone to UTC:', error.message);
  }
});

pool.connect()
  .then(async (client) => {
    console.log('✅ [notification-service] PostgreSQL connected via WebSockets');
    
    // Adjust this path based on where db.js is located relative to the root folder
    // If db.js is in /src/models/, then '..', '..' goes up to the project root.
    const schemaPath = path.join(__dirname, '..', '..', 'schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await client.query(schema);
      console.log('✅ [notification-service] Schema initialized');
    }
    
    client.release();
  })
  .catch((err) => console.error('❌ [notification-service] PostgreSQL connection failed:', err.message));

// We export 'query' so that your existing 'notificationService.js' doesn't break
module.exports = {
  query: (text, params) => pool.query(text, params),
};