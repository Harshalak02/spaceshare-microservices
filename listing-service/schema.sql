CREATE TABLE IF NOT EXISTS spaces (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  lat NUMERIC NOT NULL,
  lon NUMERIC NOT NULL,
  price_per_hour NUMERIC NOT NULL,
  capacity INT NOT NULL,
  owner_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS amenities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS space_amenities (
  space_id INT REFERENCES spaces(id) ON DELETE CASCADE,
  amenity_id INT REFERENCES amenities(id) ON DELETE CASCADE,
  PRIMARY KEY(space_id, amenity_id)
);
