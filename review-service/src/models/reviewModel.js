const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon/Cloud DBs
  },
});

pool.on("connect", () => {
  console.log("☁️ Connected to Neon Cloud Database");
});

module.exports = pool;
