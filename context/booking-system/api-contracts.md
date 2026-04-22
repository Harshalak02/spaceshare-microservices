# Booking System API Contracts

Last synchronized with implementation: 2026-04-22

## 1. API principles
- Booking is slot-based (hourly model).
- Canonical create input is start_slot_utc + slot_count.
- Legacy range payload (start_time/end_time) is accepted for compatibility.
- Booking routes are intended to be called via gateway under /api/bookings.

Gateway behavior note:
- /api/bookings/* routes are JWT-protected in api-gateway.

## 2. Implemented endpoints
### 2.1 Create booking
POST /book

Auth:
- Required

Preferred request body:
{
  "space_id": 42,
  "start_slot_utc": "2026-05-01T10:00:00Z",
  "slot_count": 3,
  "guest_count": 2,
  "idempotency_key": "optional-client-key"
}

Compatibility request body (still accepted):
{
  "space_id": 42,
  "start_time": "2026-05-01T10:00:00Z",
  "end_time": "2026-05-01T13:00:00Z",
  "guest_count": 2
}

Response body (example):
{
  "id": 9001,
  "space_id": 42,
  "user_id": 10,
  "host_id": 5,
  "start_time": "2026-05-01T10:00:00.000Z",
  "end_time": "2026-05-01T13:00:00.000Z",
  "start_slot_utc": "2026-05-01T10:00:00.000Z",
  "end_slot_utc": "2026-05-01T13:00:00.000Z",
  "slot_count": 3,
  "guest_count": 2,
  "status": "confirmed",
  "price_per_hour_snapshot": "500.00",
  "subtotal_amount": "1500.00",
  "platform_fee_amount": "0.00",
  "tax_amount": "0.00",
  "total_amount": "1500.00",
  "created_at": "2026-04-22T10:30:00.000Z"
}

Status behavior:
- instant_book_enabled=true on listing snapshot -> status=confirmed.
- instant_book_enabled=false on listing snapshot -> status=pending.

### 2.2 Get current user bookings
GET /bookings/my

Auth:
- Required

Behavior:
- Returns bookings for caller user_id.

### 2.3 Get current host bookings
GET /bookings/host/my

Auth:
- Required

Behavior:
- Returns bookings where host_id matches caller user_id.

### 2.4 Cancel booking
POST /bookings/:booking_id/cancel

Auth:
- Required

Request body:
{
  "reason": "Plan changed"
}

Behavior:
- Allowed for booking guest or booking host.
- Allowed from pending or confirmed.
- Sets status=cancelled, writes cancellation metadata, releases active booking_slots rows.

### 2.5 Get bookings by explicit user id
GET /bookings/:user_id

Auth:
- Required

Behavior:
- Caller must be same user or role=admin.

### 2.6 Internal reserved slots for listing-service
GET /internal/listings/:space_id/reserved-slots?from=YYYY-MM-DD&to=YYYY-MM-DD

Auth:
- Internal token via X-Internal-Token when INTERNAL_SERVICE_TOKEN is configured.

Response body (example):
{
  "listing_id": 42,
  "from": "2026-05-01",
  "to": "2026-05-07",
  "reserved_slots": [
    {
      "slot_start_utc": "2026-05-01T10:00:00.000Z",
      "slot_end_utc": "2026-05-01T11:00:00.000Z"
    }
  ]
}

## 3. Validation rules
1. space_id must be a positive integer.
2. start_slot_utc must be a valid timestamp.
3. slot_count must be an integer >= 1.
4. start_slot_utc must have second=0 and millisecond=0.
5. When legacy range payload is used, duration must be positive and aligned to whole-hour slots.
6. guest_count defaults to 1 and must be >= 1.
7. guest_count cannot exceed listing capacity.
8. requested slots are contiguous by construction (start slot + slot_count expansion).

## 4. Payment dependency behavior
- booking-service calls payment-service before writing booking rows.
- If payment succeeds or is bypassed by configured non-enforced policy, booking continues.
- If payment fails in enforced mode, create booking fails and no booking rows are persisted.

## 5. Error model (implemented)
Current API error shape is message-oriented:
{
  "message": "Human readable error"
}

Representative status mappings:
- 400: invalid request fields or ownership/capacity failures.
- 404: listing not found or booking not found.
- 409: booking conflict (slot already reserved).
- 500: payment failure or unexpected dependency/internal errors.

Common message patterns:
- "space_id and start_slot_utc and slot_count are required"
- "slot_count must be a positive integer"
- "start_slot_utc must align to an hour boundary"
- "Selected slot is already booked"
- "Booking not found"

## 6. Event contracts
All events are published to Redis channel events.

### 6.1 BOOKING_CREATED
{
  "type": "BOOKING_CREATED",
  "payload": {
    "booking_id": 9001,
    "space_id": 42,
    "user_id": 10,
    "host_id": 5,
    "start_time": "2026-05-01T10:00:00.000Z",
    "end_time": "2026-05-01T13:00:00.000Z",
    "start_slot_utc": "2026-05-01T10:00:00.000Z",
    "end_slot_utc": "2026-05-01T13:00:00.000Z",
    "slot_count": 3,
    "status": "pending"
  }
}

### 6.2 BOOKING_CONFIRMED
Emitted in either path:
- Create flow when initial status is confirmed.
- Status update flow (for example after PAYMENT_SUCCESS event processing).

Payload:
{
  "type": "BOOKING_CONFIRMED",
  "payload": {
    "booking_id": 9001,
    "space_id": 42,
    "user_id": 10,
    "host_id": 5,
    "start_time": "2026-05-01T10:00:00.000Z",
    "end_time": "2026-05-01T13:00:00.000Z",
    "start_slot_utc": "2026-05-01T10:00:00.000Z",
    "end_slot_utc": "2026-05-01T13:00:00.000Z",
    "slot_count": 3,
    "status": "confirmed"
  }
}

### 6.3 BOOKING_CANCELLED
{
  "type": "BOOKING_CANCELLED",
  "payload": {
    "booking_id": 9001,
    "space_id": 42,
    "user_id": 10,
    "host_id": 5,
    "cancelled_at": "2026-04-22T12:00:00.000Z",
    "reason": "Plan changed"
  }
}

## 7. Not implemented in current routes
- POST /bookings/:id/review
- Booking pagination query params (page/page_size/status/from/to)
- Dedicated completion endpoint and BOOKING_COMPLETED event