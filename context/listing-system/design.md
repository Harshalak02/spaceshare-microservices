# Listing System Detailed Design (Hourly Slot Model)

## 1. Design Goals
1. Let hosts define working-hour windows for every weekday.
2. Produce a reliable 1-hour slot calendar payload for guests.
3. Keep availability logic deterministic and timezone-safe.
4. Keep booking conflict responsibility in booking-service.

## 2. Module Design
### 2.1 Weekly Availability Module
Responsibilities:
- Persist rules per day of week.
- Validate each rule:
  - open_time < close_time
  - both aligned to hour boundary
  - slot_minutes fixed to 60

### 2.2 Date Override Module
Responsibilities:
- Persist per-date exceptions.
- Support two modes:
  - closed_all_day = true
  - custom open/close window

Precedence:
- override > weekly default.

### 2.3 Timezone Module
Responsibilities:
- Keep canonical timezone on listing.
- Convert local schedule windows to UTC slot boundaries at query time.
- Return both UTC and local timestamps for frontend rendering.

### 2.4 Slot Generator Module
Input:
- listing timezone
- weekly schedule
- overrides
- query range [from_date, to_date]

Output:
- ordered 1-hour candidate slots with status unavailable by default.

Algorithm:
1. For each date in range, determine active window using override/weekly rule.
2. Split window into 60-minute boundaries.
3. Mark all generated slots as candidate available.
4. Remove or mark slots that overlap reserved slots from booking-service.
5. Return final slot timeline.

### 2.5 Reservation Overlay Adapter
Responsibilities:
- Query booking-service internal endpoint for reserved slots.
- Merge reservation occupancy into generated slot timeline.

### 2.6 Cache Module
Cache keys:
- slots:listing:{id}:from:{yyyy-mm-dd}:to:{yyyy-mm-dd}
- availability:weekly:listing:{id}
- availability:overrides:listing:{id}:month:{yyyy-mm}

Invalidation triggers:
- host updates schedule/override
- booking created/cancelled/expired

## 3. Validation Rules
1. Daily window must be within the same local date and hour-aligned.
2. Window edges must align to hh:00.
3. close_time cannot equal open_time for open day.
4. max query range for slot endpoint in MVP: 31 days.
5. timezone is mandatory on listing create/update.
6. day_of_week uses 0..6 where 0=Sunday and 6=Saturday.

## 4. Endpoint Behavior
### Update Weekly Availability
- Replace full weekly definition in one request for consistency.

### Update Date Overrides
- Upsert override for a date.
- Delete override restores weekly behavior.

### Get Slot Timeline
- Accepts listing id and date range.
- Returns slot objects sorted by start time.
- Optional include_unavailable flag for richer UI.

## 5. Security and Policy Design
1. Only listing owner can update availability.
2. Guest can read slot timeline for active listings.
3. Admin can read/write for moderation and support operations.

## 6. Error Model
Suggested codes:
- AVAILABILITY_VALIDATION_ERROR
- AVAILABILITY_RULE_CONFLICT
- TIMEZONE_REQUIRED
- SLOT_RANGE_TOO_LARGE
- RESERVATION_DEPENDENCY_UNAVAILABLE

## 7. Rollout Design
1. Add timezone + availability tables first.
2. Keep existing listing CRUD untouched.
3. Ship host schedule endpoints.
4. Ship slot timeline endpoint.
5. Then ship frontend calendar components.

## 8. Open Decisions
1. Should hosts be forced to configure all 7 days in one call?
2. Should slot timeline include unavailable slots by default?
3. Should buffer time between bookings be in MVP or phase 2?