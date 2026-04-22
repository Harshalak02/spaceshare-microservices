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
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  slot_minutes INT NOT NULL DEFAULT 60,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add columns if upgrading from old schema
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'UTC';
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS slot_minutes INT NOT NULL DEFAULT 60;

-- Ensure lat/lon are correct type
ALTER TABLE spaces ALTER COLUMN lat TYPE DOUBLE PRECISION USING lat::DOUBLE PRECISION;
ALTER TABLE spaces ALTER COLUMN lon TYPE DOUBLE PRECISION USING lon::DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_spaces_lat_lon ON spaces(lat, lon);

CREATE TABLE IF NOT EXISTS listing_weekly_availability (
  id BIGSERIAL PRIMARY KEY,
  space_id INT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT FALSE,
  open_time_local TIME,
  close_time_local TIME,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT listing_weekly_day_range CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT listing_weekly_window_valid CHECK (
    (is_open = FALSE AND open_time_local IS NULL AND close_time_local IS NULL)
    OR
    (is_open = TRUE AND open_time_local IS NOT NULL AND close_time_local IS NOT NULL AND close_time_local > open_time_local)
  ),
  CONSTRAINT listing_weekly_unique UNIQUE (space_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS listing_availability_overrides (
  id BIGSERIAL PRIMARY KEY,
  space_id INT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  date_local DATE NOT NULL,
  closed_all_day BOOLEAN NOT NULL DEFAULT FALSE,
  open_time_local TIME,
  close_time_local TIME,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT listing_override_window_valid CHECK (
    (closed_all_day = TRUE AND open_time_local IS NULL AND close_time_local IS NULL)
    OR
    (closed_all_day = FALSE AND open_time_local IS NOT NULL AND close_time_local IS NOT NULL AND close_time_local > open_time_local)
  ),
  CONSTRAINT listing_override_unique UNIQUE (space_id, date_local)
);

CREATE INDEX IF NOT EXISTS idx_weekly_space_day ON listing_weekly_availability(space_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_override_space_date ON listing_availability_overrides(space_id, date_local);
