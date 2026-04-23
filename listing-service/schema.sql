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
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  slot_minutes INT NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add columns if upgrading from old schema
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'UTC';
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS slot_minutes INT NOT NULL DEFAULT 60;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'spaces' AND column_name = 'created_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE spaces ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'spaces' AND column_name = 'image_urls' AND data_type <> 'jsonb'
  ) THEN
    ALTER TABLE spaces ALTER COLUMN image_urls TYPE JSONB USING
      CASE
        WHEN image_urls IS NULL THEN '[]'::jsonb
        WHEN pg_typeof(image_urls)::text = 'text[]' THEN to_jsonb(image_urls)
        WHEN pg_typeof(image_urls)::text = 'text' THEN to_jsonb(ARRAY[image_urls::text])
        ELSE to_jsonb(image_urls)
      END;
  END IF;
END $$;

UPDATE spaces
SET image_urls = '[]'::jsonb
WHERE image_urls IS NULL;

ALTER TABLE spaces ALTER COLUMN image_urls SET DEFAULT '[]'::jsonb;
ALTER TABLE spaces ALTER COLUMN image_urls SET NOT NULL;

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT listing_weekly_day_range CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT listing_weekly_window_valid CHECK (
    (is_open = FALSE AND open_time_local IS NULL AND close_time_local IS NULL)
    OR
    (is_open = TRUE AND open_time_local IS NOT NULL AND close_time_local IS NOT NULL AND close_time_local > open_time_local)
  ),
  CONSTRAINT listing_weekly_unique UNIQUE (space_id, day_of_week)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'listing_weekly_availability' AND column_name = 'created_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE listing_weekly_availability ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'listing_weekly_availability' AND column_name = 'updated_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE listing_weekly_availability ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS listing_availability_overrides (
  id BIGSERIAL PRIMARY KEY,
  space_id INT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  date_local DATE NOT NULL,
  closed_all_day BOOLEAN NOT NULL DEFAULT FALSE,
  open_time_local TIME,
  close_time_local TIME,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT listing_override_window_valid CHECK (
    (closed_all_day = TRUE AND open_time_local IS NULL AND close_time_local IS NULL)
    OR
    (closed_all_day = FALSE AND open_time_local IS NOT NULL AND close_time_local IS NOT NULL AND close_time_local > open_time_local)
  ),
  CONSTRAINT listing_override_unique UNIQUE (space_id, date_local)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'listing_availability_overrides' AND column_name = 'created_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE listing_availability_overrides ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'listing_availability_overrides' AND column_name = 'updated_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE listing_availability_overrides ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_weekly_space_day ON listing_weekly_availability(space_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_override_space_date ON listing_availability_overrides(space_id, date_local);
