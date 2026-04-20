CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  plan_type VARCHAR(50) NOT NULL,
  expiry_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
