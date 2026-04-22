# Listing System API Contracts (Hourly Slot Model)

## 1. API Principles
- Keep existing listing CRUD endpoints.
- Add explicit availability and slot timeline endpoints.
- Slot size fixed to 60 minutes for MVP.

Base path through gateway: /api/listings

## 2. Existing Endpoints (unchanged)
1. GET /spaces
2. GET /spaces/:id
3. GET /spaces/my
4. POST /spaces
5. PUT /spaces/:id
6. DELETE /spaces/:id

## 3. New Availability Endpoints
### 3.1 Weekly schedule
1. GET /spaces/:id/availability/weekly
- Returns Monday-Sunday schedule.

2. PUT /spaces/:id/availability/weekly
- Replaces full weekly schedule.
- Auth: host owner.
- Convention: day_of_week uses 0..6 where 0=Sunday and 6=Saturday.

Request body:
{
  timezone: "Asia/Kolkata",
  week: [
    { day_of_week: 0, is_open: true, open_time_local: "06:00", close_time_local: "22:00" },
    { day_of_week: 1, is_open: true, open_time_local: "06:00", close_time_local: "22:00" },
    { day_of_week: 2, is_open: true, open_time_local: "06:00", close_time_local: "22:00" },
    { day_of_week: 3, is_open: true, open_time_local: "06:00", close_time_local: "22:00" },
    { day_of_week: 4, is_open: true, open_time_local: "06:00", close_time_local: "22:00" },
    { day_of_week: 5, is_open: true, open_time_local: "06:00", close_time_local: "22:00" },
    { day_of_week: 6, is_open: true, open_time_local: "06:00", close_time_local: "22:00" }
  ]
}

### 3.2 Date overrides
3. GET /spaces/:id/availability/overrides?from=YYYY-MM-DD&to=YYYY-MM-DD

4. PUT /spaces/:id/availability/overrides
- Upsert date override.

Request body:
{
  date_local: "2026-05-01",
  closed_all_day: false,
  open_time_local: "10:00",
  close_time_local: "16:00",
  note: "Holiday reduced hours"
}

5. DELETE /spaces/:id/availability/overrides/:override_id

## 4. Slot Timeline Endpoint
6. GET /spaces/:id/slots?from=YYYY-MM-DD&to=YYYY-MM-DD&include_unavailable=false
- Public for active listings.
- Range limit: maximum 31 days in MVP.
- If include_unavailable=false, response returns only available slots.
- If include_unavailable=true, slot status can be available, reserved, or unavailable.

Response:
{
  listing_id: 42,
  timezone: "Asia/Kolkata",
  slot_minutes: 60,
  from: "2026-05-01",
  to: "2026-05-07",
  slots: [
    {
      slot_start_utc: "2026-05-01T00:30:00Z",
      slot_end_utc: "2026-05-01T01:30:00Z",
      slot_start_local: "2026-05-01T06:00:00+05:30",
      slot_end_local: "2026-05-01T07:00:00+05:30",
      status: "available"
    }
  ]
}

## 5. Validation Rules
- open_time_local and close_time_local must align to full hour.
- close_time_local must be greater than open_time_local.
- timezone required.
- no overnight windows in MVP.

## 6. Error Model
Example:
{
  code: "AVAILABILITY_VALIDATION_ERROR",
  message: "close_time_local must be greater than open_time_local",
  details: null,
  correlation_id: "req-abc"
}

Suggested error codes:
- AVAILABILITY_VALIDATION_ERROR
- AVAILABILITY_RULE_CONFLICT
- TIMEZONE_REQUIRED
- SLOT_RANGE_TOO_LARGE
- LISTING_FORBIDDEN
- RESERVATION_DEPENDENCY_UNAVAILABLE

## 7. Internal Service Contract with Booking
Internal read endpoint expected from booking-service:
- GET /internal/listings/:id/reserved-slots?from=...&to=...
- Access control: service-to-service only (not public client traffic).

Response:
{
  listing_id: 42,
  reserved_slots: [
    { slot_start_utc: "2026-05-01T02:30:00Z", slot_end_utc: "2026-05-01T03:30:00Z" }
  ]
}

## 8. Compatibility
- Existing listing endpoints and payloads remain valid.
- New availability fields are additive.
- Frontend can progressively migrate to slot timeline UI.