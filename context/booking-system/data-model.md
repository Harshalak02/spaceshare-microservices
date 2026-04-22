# Booking System Data Model

Last synchronized with implementation: 2026-04-22

## 1. Data model goals
1. Persist canonical booking snapshot for pricing and lifecycle.
2. Guarantee slot-level conflict safety under concurrency.
3. Support internal reservation export and user/host booking reads.

## 2. Implemented tables
### 2.1 bookings
Purpose:
- Core booking record and lifecycle state.

Columns (implemented):
- id SERIAL PRIMARY KEY
- space_id INT NOT NULL
- user_id INT NOT NULL
- start_time TIMESTAMP NOT NULL
- end_time TIMESTAMP NOT NULL
- host_id INT NULL
- start_slot_utc TIMESTAMP NULL
- end_slot_utc TIMESTAMP NULL
- slot_count INT DEFAULT 1
- guest_count INT DEFAULT 1
- status VARCHAR(32) NOT NULL DEFAULT 'confirmed'
- price_per_hour_snapshot NUMERIC(12,2) DEFAULT 0
- subtotal_amount NUMERIC(12,2) DEFAULT 0
- platform_fee_amount NUMERIC(12,2) DEFAULT 0
- tax_amount NUMERIC(12,2) DEFAULT 0
- total_amount NUMERIC(12,2) DEFAULT 0
- cancellation_policy_snapshot VARCHAR(32) DEFAULT 'moderate'
- cancellation_reason TEXT NULL
- cancelled_at TIMESTAMP NULL
- refund_amount NUMERIC(12,2) NULL
- completed_at TIMESTAMP NULL
- idempotency_key VARCHAR(128) NULL
- created_at TIMESTAMP DEFAULT NOW()

Schema notes:
- Legacy fields start_time/end_time remain mandatory for compatibility.
- Slot fields are populated for canonical slot-based create path.
- status does not currently have a DB CHECK constraint.

### 2.2 booking_slots
Purpose:
- Slot occupancy source of truth for conflict control and timeline export.

Columns:
- id BIGSERIAL PRIMARY KEY
- booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE
- space_id INT NOT NULL
- slot_start_utc TIMESTAMP NOT NULL
- slot_end_utc TIMESTAMP NOT NULL
- occupancy_status VARCHAR(16) NOT NULL DEFAULT 'active'
- created_at TIMESTAMP NOT NULL DEFAULT NOW()

Constraints:
- slot_end_utc > slot_start_utc
- occupancy_status IN ('active', 'released')

### 2.3 booking_status_history
Purpose:
- Append-only transition audit trail.

Columns:
- id BIGSERIAL PRIMARY KEY
- booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE
- old_status VARCHAR(32) NOT NULL
- new_status VARCHAR(32) NOT NULL
- changed_by INT NOT NULL
- reason TEXT NULL
- changed_at TIMESTAMP NOT NULL DEFAULT NOW()

## 3. Implemented indexes
- uniq_active_space_slot ON booking_slots(space_id, slot_start_utc)
  where occupancy_status='active'
- uniq_bookings_idempotency ON bookings(idempotency_key)
  where idempotency_key IS NOT NULL
- idx_bookings_user_time ON bookings(user_id, start_time DESC)
- idx_bookings_host_time ON bookings(host_id, start_time DESC)
- idx_booking_slots_space_time ON booking_slots(space_id, slot_start_utc)

## 4. Conflict prevention behavior
Create transaction behavior:
1. Insert bookings row.
2. Insert one booking_slots row per hour.
3. If uniq_active_space_slot conflicts, transaction rolls back.
4. API responds with conflict and no partial booking is committed.

## 5. Lifecycle storage notes
- Cancellation sets status=cancelled and writes cancellation_reason/cancelled_at.
- Cancellation updates booking_slots rows to occupancy_status='released'.
- Status updates are recorded in booking_status_history.

## 6. Compatibility and migration notes
- start_slot_utc/end_slot_utc/slot_count are additive evolutions over legacy range model.
- Existing rows can continue to coexist while clients migrate fully to slot payloads.

## 7. Planned but not implemented tables
- booking_reviews table is not present in current schema.
- No dedicated refunds table in current schema.