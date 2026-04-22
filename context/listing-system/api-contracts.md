# Listing System API Contracts

Last synchronized with implementation: 2026-04-22

## 1. API principles
- Listing CRUD and availability APIs are implemented in listing-service.
- Slot size is fixed to 60 minutes in current model.
- Slot timeline is generated dynamically; candidate slots are not pre-materialized.

Gateway note:
- Through api-gateway, all /api/listings/* routes require JWT.

Service-direct note:
- Some listing-service routes are public when called directly (bypassing gateway), as defined in listing-service route middleware.

## 2. Implemented listing endpoints
### 2.1 Space CRUD and reads
1. GET /spaces
2. GET /spaces/:id
3. GET /spaces/my (auth required)
4. POST /spaces (auth required)
5. PUT /spaces/:id (auth required, owner only)
6. DELETE /spaces/:id (auth required, owner only)

Create/update validation highlights:
- title, lat, lon, price_per_hour, capacity are required for create.
- price_per_hour > 0 and capacity > 0.
- timezone must be valid when provided.

### 2.2 Helper endpoints
1. GET /amenities
2. GET /autocomplete?q=<text>
3. GET /reverse?lat=<num>&lon=<num>

Behavior notes:
- amenities returns static key/label list.
- autocomplete matches location_name values.
- reverse returns nearest known location_name by coordinate distance.

### 2.3 Weekly availability
1. GET /spaces/:id/availability/weekly (auth required, owner only)
2. PUT /spaces/:id/availability/weekly (auth required, owner only)

PUT request body (example):
{
  "timezone": "Asia/Kolkata",
  "week": [
    { "day_of_week": 0, "is_open": true, "open_time_local": "06:00", "close_time_local": "22:00" },
    { "day_of_week": 1, "is_open": true, "open_time_local": "06:00", "close_time_local": "22:00" },
    { "day_of_week": 2, "is_open": true, "open_time_local": "06:00", "close_time_local": "22:00" },
    { "day_of_week": 3, "is_open": true, "open_time_local": "06:00", "close_time_local": "22:00" },
    { "day_of_week": 4, "is_open": true, "open_time_local": "06:00", "close_time_local": "22:00" },
    { "day_of_week": 5, "is_open": true, "open_time_local": "06:00", "close_time_local": "22:00" },
    { "day_of_week": 6, "is_open": true, "open_time_local": "06:00", "close_time_local": "22:00" }
  ]
}

Rules:
- week must include all day_of_week values 0 through 6.
- open_time_local and close_time_local must be hour-aligned (HH:00) for open days.
- close_time_local must be greater than open_time_local.

### 2.4 Date overrides
1. GET /spaces/:id/availability/overrides?from=YYYY-MM-DD&to=YYYY-MM-DD (auth required, owner only)
2. PUT /spaces/:id/availability/overrides (auth required, owner only)
3. DELETE /spaces/:id/availability/overrides/:overrideId (auth required, owner only)

PUT request body (example):
{
  "date_local": "2026-05-01",
  "closed_all_day": false,
  "open_time_local": "10:00",
  "close_time_local": "16:00",
  "note": "Holiday reduced hours"
}

Rules:
- date_local is required and must be valid date format.
- when closed_all_day=true, open/close times are cleared.
- when closed_all_day=false, open/close times are required and hour-aligned.

### 2.5 Slot timeline
GET /spaces/:id/slots?from=YYYY-MM-DD&to=YYYY-MM-DD&include_unavailable=false

Query rules:
- from and to are required.
- to must be on or after from.
- max range is 31 days.

Response body (example):
{
  "listing_id": 42,
  "timezone": "Asia/Kolkata",
  "slot_minutes": 60,
  "from": "2026-05-01",
  "to": "2026-05-07",
  "slots": [
    {
      "slot_start_utc": "2026-05-01T00:30:00Z",
      "slot_end_utc": "2026-05-01T01:30:00Z",
      "slot_start_local": "2026-05-01T06:00:00+05:30",
      "slot_end_local": "2026-05-01T07:00:00+05:30",
      "status": "available"
    }
  ]
}

Status semantics:
- available: slot generated from schedule and not reserved.
- reserved: slot generated from schedule and present in booking reserved-slot overlay.

include_unavailable behavior:
- false (default): returns only available slots.
- true: returns available and reserved generated slots.

## 3. Booking-service dependency contract
listing-service calls booking-service internal API:
- GET /internal/listings/:space_id/reserved-slots?from=...&to=...

Expected response payload fields:
- listing_id
- from
- to
- reserved_slots[] with slot_start_utc and slot_end_utc

Auth note:
- X-Internal-Token header is sent when INTERNAL_SERVICE_TOKEN is configured.

## 4. Error model (implemented)
Primary error shape:
{
  "message": "Failed to ...",
  "error": "Detailed cause"
}

Representative statuses:
- 400: validation failure or bad slot range input.
- 403: owner authorization failure.
- 404: space not found.
- 500: internal failures for CRUD and helper endpoints.

## 5. Compatibility and path notes
- Search discovery for public guests is provided by search-service at /api/search/spaces.
- Listing slot endpoint exists in listing-service; when consumed via gateway it is auth-protected.
- Existing CRUD payload fields remain valid with additive timezone and slot-related fields.