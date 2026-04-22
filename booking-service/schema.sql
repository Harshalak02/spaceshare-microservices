CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  space_id INT NOT NULL,
  user_id INT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  host_id INT,
  start_slot_utc TIMESTAMP,
  end_slot_utc TIMESTAMP,
  slot_count INT DEFAULT 1,
  guest_count INT DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'confirmed',
  price_per_hour_snapshot NUMERIC(12,2) DEFAULT 0,
  subtotal_amount NUMERIC(12,2) DEFAULT 0,
  platform_fee_amount NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  cancellation_policy_snapshot VARCHAR(32) DEFAULT 'moderate',
  cancellation_reason TEXT,
  cancelled_at TIMESTAMP,
  refund_amount NUMERIC(12,2),
  completed_at TIMESTAMP,
  idempotency_key VARCHAR(128),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_id INT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_slot_utc TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_slot_utc TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS slot_count INT DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_count INT DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'confirmed';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS price_per_hour_snapshot NUMERIC(12,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_policy_snapshot VARCHAR(32) DEFAULT 'moderate';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);

CREATE TABLE IF NOT EXISTS booking_slots (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  space_id INT NOT NULL,
  slot_start_utc TIMESTAMP NOT NULL,
  slot_end_utc TIMESTAMP NOT NULL,
  occupancy_status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_slot_window CHECK (slot_end_utc > slot_start_utc),
  CONSTRAINT booking_slot_status CHECK (occupancy_status IN ('active', 'released'))
);

CREATE TABLE IF NOT EXISTS booking_status_history (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  old_status VARCHAR(32) NOT NULL,
  new_status VARCHAR(32) NOT NULL,
  changed_by INT NOT NULL,
  reason TEXT,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_space_slot
ON booking_slots(space_id, slot_start_utc)
WHERE occupancy_status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_bookings_idempotency
ON bookings(idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_user_time ON bookings(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_host_time ON bookings(host_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_booking_slots_space_time ON booking_slots(space_id, slot_start_utc);
