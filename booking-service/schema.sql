CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  space_id INT NOT NULL,
  user_id INT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
