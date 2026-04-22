# Booking System Data Model Plan (Hourly Slot Model)

## 1. Design Objectives
1. Persist booking lifecycle and pricing snapshots.
2. Persist slot occupancy for deterministic conflict prevention.
3. Support fast booking list and reserved-slot export queries.

## 2. Proposed Tables
### 2.1 bookings (extended)
Core columns:
- id BIGSERIAL PRIMARY KEY
- space_id INT NOT NULL
- user_id INT NOT NULL
- host_id INT NOT NULL
- start_slot_utc TIMESTAMP NOT NULL
- end_slot_utc TIMESTAMP NOT NULL
- slot_count INT NOT NULL
- guest_count INT NOT NULL DEFAULT 1
- status VARCHAR(32) NOT NULL DEFAULT 'confirmed'
- price_per_hour_snapshot NUMERIC(12,2) NOT NULL
- subtotal_amount NUMERIC(12,2) NOT NULL
- platform_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0
- tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0
- total_amount NUMERIC(12,2) NOT NULL
- cancellation_policy_snapshot VARCHAR(32) NOT NULL DEFAULT 'moderate'
- cancellation_reason TEXT NULL
- cancelled_at TIMESTAMP NULL
- refund_amount NUMERIC(12,2) NULL
- completed_at TIMESTAMP NULL
- idempotency_key VARCHAR(128) NULL
- created_at TIMESTAMP NOT NULL DEFAULT NOW()
- updated_at TIMESTAMP NOT NULL DEFAULT NOW()

Constraints:
- CHECK (slot_count >= 1)
- CHECK (guest_count >= 1)
- CHECK (end_slot_utc > start_slot_utc)
- CHECK (status IN ('pending','confirmed','cancelled','completed','refunded'))

### 2.2 booking_slots
Purpose: slot-level occupancy and conflict guarantee.

Columns:
- id BIGSERIAL PRIMARY KEY
- booking_id BIGINT NOT NULL REFERENCES bookings(id)
- space_id INT NOT NULL
- slot_start_utc TIMESTAMP NOT NULL
- slot_end_utc TIMESTAMP NOT NULL
- occupancy_status VARCHAR(16) NOT NULL DEFAULT 'active'
- created_at TIMESTAMP NOT NULL DEFAULT NOW()

Constraints:
- CHECK (slot_end_utc > slot_start_utc)
- CHECK (occupancy_status IN ('active','released'))

Uniqueness:
- UNIQUE active slot occupancy by space and slot_start_utc.

Implementation option:
- partial unique index:
  CREATE UNIQUE INDEX uniq_active_space_slot
  ON booking_slots(space_id, slot_start_utc)
  WHERE occupancy_status = 'active';

### 2.3 booking_status_history
- id BIGSERIAL PRIMARY KEY
- booking_id BIGINT NOT NULL REFERENCES bookings(id)
- old_status VARCHAR(32) NOT NULL
- new_status VARCHAR(32) NOT NULL
- changed_by INT NOT NULL
- reason TEXT NULL
- changed_at TIMESTAMP NOT NULL DEFAULT NOW()

### 2.4 booking_reviews (optional MVP+)
- id BIGSERIAL PRIMARY KEY
- booking_id BIGINT NOT NULL REFERENCES bookings(id)
- reviewer_user_id INT NOT NULL
- reviewer_role VARCHAR(16) NOT NULL
- rating INT NOT NULL
- comment TEXT NULL
- created_at TIMESTAMP NOT NULL DEFAULT NOW()
- UNIQUE (booking_id, reviewer_user_id)

## 3. Index Strategy
- idx_bookings_user_time ON bookings(user_id, start_slot_utc DESC)
- idx_bookings_host_time ON bookings(host_id, start_slot_utc DESC)
- idx_bookings_space_time ON bookings(space_id, start_slot_utc)
- uniq_bookings_idempotency_key ON bookings(idempotency_key) WHERE idempotency_key IS NOT NULL
- idx_booking_slots_space_time ON booking_slots(space_id, slot_start_utc)
- idx_booking_slots_booking_id ON booking_slots(booking_id)

## 4. Conflict Prevention Approach
During create booking transaction:
1. Insert booking row (pending temporary state).
2. Insert each requested slot row into booking_slots with occupancy_status=active.
3. Any unique conflict means slot already taken -> rollback -> BOOKING_CONFLICT.

## 5. Migration Plan
1. Add new slot-based columns to bookings.
2. Create booking_slots and status_history tables.
3. Backfill existing range bookings into slot_count and booking_slots where possible.
4. Gradually switch API to start_slot_utc + slot_count.

## 6. Data Retention
- bookings retained for audit/dispute history.
- booking_slots retained for historical analytics even when released.

## 7. Rollback Safety
- additive schema changes first.
- old fields can remain until clients fully migrate.