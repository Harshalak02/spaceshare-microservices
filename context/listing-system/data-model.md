# Listing System Data Model

Last synchronized with implementation: 2026-04-22

## 1. Data model goals
1. Store listing metadata and ownership.
2. Store weekly and per-date availability rules.
3. Support efficient slot generation without persisted slot rows.

## 2. Implemented tables
### 2.1 spaces
Core columns:
- id SERIAL PRIMARY KEY
- title TEXT NOT NULL
- description TEXT
- location_name TEXT
- lat DOUBLE PRECISION
- lon DOUBLE PRECISION
- price_per_hour NUMERIC
- capacity INT
- owner_id INT
- timezone VARCHAR(64) NOT NULL DEFAULT 'UTC'
- slot_minutes INT NOT NULL DEFAULT 60
- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

Notes:
- timezone is validated in service logic.
- slot_minutes currently defaults to 60 and is consumed as read-only behavior.

### 2.2 listing_weekly_availability
Purpose:
- one schedule rule per listing per weekday.

Columns:
- id BIGSERIAL PRIMARY KEY
- space_id INT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE
- day_of_week INT NOT NULL
- is_open BOOLEAN NOT NULL DEFAULT FALSE
- open_time_local TIME
- close_time_local TIME
- created_at TIMESTAMP NOT NULL DEFAULT NOW()
- updated_at TIMESTAMP NOT NULL DEFAULT NOW()

Constraints:
- day_of_week between 0 and 6.
- closed day requires null open/close times.
- open day requires non-null open/close with close > open.
- unique (space_id, day_of_week).

### 2.3 listing_availability_overrides
Purpose:
- date-specific schedule exceptions.

Columns:
- id BIGSERIAL PRIMARY KEY
- space_id INT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE
- date_local DATE NOT NULL
- closed_all_day BOOLEAN NOT NULL DEFAULT FALSE
- open_time_local TIME
- close_time_local TIME
- note TEXT
- created_at TIMESTAMP NOT NULL DEFAULT NOW()
- updated_at TIMESTAMP NOT NULL DEFAULT NOW()

Constraints:
- closed_all_day=true requires null open/close times.
- closed_all_day=false requires open/close times with close > open.
- unique (space_id, date_local).

## 3. Implemented indexes
- idx_spaces_lat_lon ON spaces(lat, lon)
- idx_weekly_space_day ON listing_weekly_availability(space_id, day_of_week)
- idx_override_space_date ON listing_availability_overrides(space_id, date_local)

## 4. Slot materialization model
- No generated slot table exists in DB.
- Slots are generated at query time from weekly + override rules.
- Reserved slots are fetched from booking-service and overlaid in memory.

## 5. Data quality and validation rules
1. week upsert requires all 7 day_of_week entries.
2. open/close times must be hour-aligned (HH:00) in service validation.
3. close_time_local must be strictly greater than open_time_local.
4. date_local must be valid ISO date for overrides.

## 6. Consistency notes
- listing-service is authoritative for schedule rules.
- booking-service is authoritative for reservations.
- slot cache freshness is TTL-driven with invalidation on listing schedule mutations.

## 7. Known schema limitations
1. No DB CHECK enforces slot_minutes=60.
2. No persisted slot history table in listing-service.
3. No per-listing custom slot duration currently supported by logic.