CREATE TABLE IF NOT EXISTS spaces (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location_name TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  price_per_hour NUMERIC,
  capacity INT,
  owner_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add columns if upgrading from old schema
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS description TEXT;

-- Ensure lat/lon are correct type
ALTER TABLE spaces ALTER COLUMN lat TYPE DOUBLE PRECISION USING lat::DOUBLE PRECISION;
ALTER TABLE spaces ALTER COLUMN lon TYPE DOUBLE PRECISION USING lon::DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_spaces_lat_lon ON spaces(lat, lon);
