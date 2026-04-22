# Booking System API Contracts (Hourly Slot Model)

## 1. API Principles
- Booking is slot-based, not night-based.
- Request uses start_slot_utc + slot_count.
- Existing endpoints preserved where practical, with additive fields.

Base path through gateway: /api/bookings

## 2. Public/Authenticated Endpoints
### 2.1 Create booking
POST /book

Request:
{
  space_id: 42,
  start_slot_utc: "2026-05-01T10:00:00Z",
  slot_count: 3,
  guest_count: 2
}

Response:
{
  id: 9001,
  space_id: 42,
  user_id: 10,
  host_id: 5,
  start_slot_utc: "2026-05-01T10:00:00Z",
  end_slot_utc: "2026-05-01T13:00:00Z",
  slot_count: 3,
  status: "confirmed",
  subtotal_amount: 1500,
  platform_fee_amount: 150,
  tax_amount: 0,
  total_amount: 1650,
  created_at: "2026-04-22T10:30:00Z"
}

Status behavior:
- instant-book listing: status is confirmed on create.
- approval-required listing: status is pending on create.

### 2.2 Guest bookings
GET /bookings/my
- returns caller's bookings.

### 2.3 Host bookings
GET /bookings/host/my
- returns bookings for caller-owned listings.

### 2.4 Cancel booking
PATCH /bookings/:id/cancel

Request:
{
  reason: "Plan changed"
}

### 2.5 Review booking
POST /bookings/:id/review

Request:
{
  rating: 5,
  comment: "Great space"
}

## 3. Internal Endpoint for Listing-service
GET /internal/listings/:id/reserved-slots?from=YYYY-MM-DD&to=YYYY-MM-DD
- Access control: internal service-to-service only.

Response:
{
  listing_id: 42,
  reserved_slots: [
    {
      slot_start_utc: "2026-05-01T10:00:00Z",
      slot_end_utc: "2026-05-01T11:00:00Z"
    }
  ]
}

## 4. Deprecated/Compatibility Notes
- old start_time/end_time request can be temporarily accepted and mapped to slot_count if exactly hour-aligned.
- non-hour aligned requests should fail validation.

## 5. Validation Rules
1. start_slot_utc must be minute=00, second=00.
2. slot_count must be >= 1.
3. derived end must be after start.
4. guest_count must not exceed listing capacity.
5. requested slots must be contiguous.

## 6. Error Model
Example:
{
  code: "BOOKING_CONFLICT",
  message: "One or more requested slots are already reserved",
  details: { conflicting_slot_start_utc: "2026-05-01T11:00:00Z" },
  correlation_id: "req-xyz"
}

Error codes:
- BOOKING_VALIDATION_ERROR
- BOOKING_CONFLICT
- BOOKING_FORBIDDEN
- BOOKING_NOT_FOUND
- LISTING_UNAVAILABLE
- BOOKING_INVALID_STATE_TRANSITION
- DEPENDENCY_UNAVAILABLE

## 7. Event Contracts
1. BOOKING_CREATED
{
  type: "BOOKING_CREATED",
  payload: {
    booking_id: 9001,
    space_id: 42,
    slot_count: 3,
    status: "pending"
  }
}

2. BOOKING_CONFIRMED
{
  type: "BOOKING_CONFIRMED",
  payload: {
    booking_id: 9001,
    space_id: 42,
    slot_count: 3,
    start_slot_utc: "2026-05-01T10:00:00Z",
    end_slot_utc: "2026-05-01T13:00:00Z"
  }
}

3. BOOKING_CANCELLED
{
  type: "BOOKING_CANCELLED",
  payload: {
    booking_id: 9001,
    space_id: 42,
    cancelled_at: "2026-04-22T12:00:00Z"
  }
}

4. BOOKING_COMPLETED
{
  type: "BOOKING_COMPLETED",
  payload: {
    booking_id: 9001,
    space_id: 42,
    completed_at: "2026-05-01T13:05:00Z"
  }
}

## 8. Pagination and Filters
List endpoints support:
- page
- page_size
- status
- from_utc
- to_utc