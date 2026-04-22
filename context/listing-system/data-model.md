# Listing System Data Model Plan (Hourly Slot Model)

## 1. Design Objectives
1. Represent host availability windows by weekday.
2. Support date-specific exceptions.
3. Keep slot size fixed to 60 minutes.
4. Enable fast slot timeline generation.

## 2. Existing Core Table
spaces table remains the listing source of truth and is extended with timezone.

## 3. Proposed Tables
### 3.1 spaces (extensions)
New columns:
- timezone VARCHAR(64) NOT NULL DEFAULT 'UTC'
- slot_minutes INT NOT NULL DEFAULT 60

Constraints:
- CHECK (slot_minutes = 60) for MVP

### 3.2 listing_weekly_availability
Purpose: one rule per listing per weekday.

Columns:
- id BIGSERIAL PRIMARY KEY
- space_id INT NOT NULL REFERENCES spaces(id)
- day_of_week INT NOT NULL
- is_open BOOLEAN NOT NULL DEFAULT false
- open_time_local TIME NULL
- close_time_local TIME NULL
- created_at TIMESTAMP NOT NULL DEFAULT NOW()
- updated_at TIMESTAMP NOT NULL DEFAULT NOW()

Constraints:
- CHECK (day_of_week BETWEEN 0 AND 6)
- CHECK (
    (is_open = false AND open_time_local IS NULL AND close_time_local IS NULL)
    OR
    (is_open = true AND open_time_local IS NOT NULL AND close_time_local IS NOT NULL AND close_time_local > open_time_local)
  )
- UNIQUE (space_id, day_of_week)

Convention:
- day_of_week uses 0..6 where 0=Sunday and 6=Saturday.

### 3.3 listing_availability_overrides
Purpose: date-specific exceptions.

Columns:
- id BIGSERIAL PRIMARY KEY
- space_id INT NOT NULL REFERENCES spaces(id)
- date_local DATE NOT NULL
- closed_all_day BOOLEAN NOT NULL DEFAULT false
- open_time_local TIME NULL
- close_time_local TIME NULL
- note TEXT NULL
- created_at TIMESTAMP NOT NULL DEFAULT NOW()
- updated_at TIMESTAMP NOT NULL DEFAULT NOW()

Constraints:
- CHECK (
    (closed_all_day = true AND open_time_local IS NULL AND close_time_local IS NULL)
    OR
    (closed_all_day = false AND open_time_local IS NOT NULL AND close_time_local IS NOT NULL AND close_time_local > open_time_local)
  )
- UNIQUE (space_id, date_local)

## 4. Index Strategy
- idx_weekly_space_day ON listing_weekly_availability(space_id, day_of_week)
- idx_override_space_date ON listing_availability_overrides(space_id, date_local)
- idx_spaces_timezone ON spaces(timezone)

## 5. Slot Materialization Strategy
MVP decision:
- Do not persist generated candidate slots in listing DB.
- Generate slots on read using weekly rules + overrides + reservation overlay.

Reason:
- Avoid storage explosion for long horizons.
- Easier updates when host changes schedule.

## 6. Consistency Notes
- Listing-service is authoritative for availability rules.
- Booking-service is authoritative for occupied slots.
- Slot timeline is a composed read model.

## 7. Migration Plan
1. Add timezone and slot_minutes columns to spaces.
2. Create weekly and override tables.
3. Backfill timezone for existing spaces using configured default.
4. Initialize weekly schedule defaults for existing hosts if required by UX.

## 8. Data Quality Rules
1. Times must be hour-aligned in application validation.
2. No overnight windows in MVP.
3. date_local stored in listing timezone semantics.

## 9. Rollback Safety
- All additions are additive.
- Existing listing CRUD remains operational without schedule usage.
- Feature flag can guard slot endpoint rollout.