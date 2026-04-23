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
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE spaces ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS owner_id INT;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

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

ALTER TABLE spaces ALTER COLUMN lat TYPE DOUBLE PRECISION USING lat::DOUBLE PRECISION;
ALTER TABLE spaces ALTER COLUMN lon TYPE DOUBLE PRECISION USING lon::DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_search_spaces_lat_lon ON spaces(lat, lon);
