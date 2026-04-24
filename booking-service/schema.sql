CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  space_id INT NOT NULL,
  user_id INT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  host_id INT,
  start_slot_utc TIMESTAMPTZ,
  end_slot_utc TIMESTAMPTZ,
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
  cancelled_at TIMESTAMPTZ,
  refund_amount NUMERIC(12,2),
  completed_at TIMESTAMPTZ,
  idempotency_key VARCHAR(128),
  payment_window_started_at TIMESTAMP,
  payment_window_expires_at TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS host_id INT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_slot_utc TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_slot_utc TIMESTAMPTZ;
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
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'start_time' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE bookings ALTER COLUMN start_time TYPE TIMESTAMPTZ USING start_time AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'end_time' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE bookings ALTER COLUMN end_time TYPE TIMESTAMPTZ USING end_time AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'start_slot_utc' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE bookings ALTER COLUMN start_slot_utc TYPE TIMESTAMPTZ USING start_slot_utc AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'end_slot_utc' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE bookings ALTER COLUMN end_slot_utc TYPE TIMESTAMPTZ USING end_slot_utc AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'created_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE bookings ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'cancelled_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE bookings ALTER COLUMN cancelled_at TYPE TIMESTAMPTZ USING cancelled_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'completed_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE bookings ALTER COLUMN completed_at TYPE TIMESTAMPTZ USING completed_at AT TIME ZONE 'UTC';
  END IF;
END $$;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_window_started_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_window_expires_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS booking_slots (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  space_id INT NOT NULL,
  slot_start_utc TIMESTAMPTZ NOT NULL,
  slot_end_utc TIMESTAMPTZ NOT NULL,
  occupancy_status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_slot_window CHECK (slot_end_utc > slot_start_utc),
  CONSTRAINT booking_slot_status CHECK (occupancy_status IN ('active', 'released'))
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_slots' AND column_name = 'slot_start_utc' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE booking_slots ALTER COLUMN slot_start_utc TYPE TIMESTAMPTZ USING slot_start_utc AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_slots' AND column_name = 'slot_end_utc' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE booking_slots ALTER COLUMN slot_end_utc TYPE TIMESTAMPTZ USING slot_end_utc AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_slots' AND column_name = 'created_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE booking_slots ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS booking_status_history (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  old_status VARCHAR(32) NOT NULL,
  new_status VARCHAR(32) NOT NULL,
  changed_by INT NOT NULL,
  reason TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_status_history' AND column_name = 'changed_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE booking_status_history ALTER COLUMN changed_at TYPE TIMESTAMPTZ USING changed_at AT TIME ZONE 'UTC';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_space_slot
ON booking_slots(space_id, slot_start_utc)
WHERE occupancy_status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_bookings_idempotency
ON bookings(idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_user_time ON bookings(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_host_time ON bookings(host_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_booking_slots_space_time ON booking_slots(space_id, slot_start_utc);

-- ──────────────────────────────────────────────────────────
-- Outbox Events table (Fix 8: Transactional Outbox Pattern)
-- Events are inserted within the same transaction as the
-- booking write, then published by a background poller.
-- This guarantees at-least-once delivery without external queues.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outbox_events (
  id BIGSERIAL PRIMARY KEY,
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id BIGINT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  published BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_outbox_unpublished
ON outbox_events(published, created_at)
WHERE published = FALSE;
