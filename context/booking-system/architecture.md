# Booking System Architecture

Last synchronized with implementation: 2026-04-22

## 1. Scope
Booking-service handles reservation truth for SpaceShare hourly bookings.

Current product behavior:
- Booking unit is one-hour slots.
- Multi-slot booking is contiguous from start_slot_utc using slot_count.
- Listing schedule and slot visibility are owned by listing-service.
- Booking-service is source of truth for occupied slots.

## 2. Bounded context ownership
- listing-service owns listing metadata and schedule rules.
- booking-service owns booking lifecycle and slot occupancy.
- payment-service owns charge/session lifecycle.
- booking-service provides internal reserved-slot export for listing-service.

## 3. Implemented components
1. API module
- create, cancel, guest list, host list, by-user list, reserved-slot export.

2. Validation and normalization module
- validates create payload and supports compatibility mapping from legacy range payload.

3. Listing snapshot adapter
- fetches listing details from listing-service and validates capacity and host data.

4. Payment bridge
- delegates charge/session attempt to payment-service before booking persistence.

5. Slot occupancy module
- writes booking_slots records and relies on active-slot unique index for race safety.

6. Lifecycle module
- supports pending/confirmed/cancelled transitions and status history writes.

7. Event publisher/subscriber
- publishes BOOKING_* events.
- subscribes to PAYMENT_SUCCESS and updates booking status to confirmed.

## 4. Runtime flows
### Flow A: Create booking
1. Client calls POST /book via gateway-authenticated route.
2. booking-service validates payload and derives canonical slot fields.
3. booking-service fetches listing snapshot from listing-service.
4. booking-service computes pricing snapshot and target status.
5. booking-service calls payment-service bridge.
6. On successful payment path, service starts DB transaction:
- inserts bookings row
- inserts booking_slots rows
7. If slot insert conflicts on unique index, transaction rolls back and returns conflict.
8. On success, BOOKING_CREATED is emitted; BOOKING_CONFIRMED is also emitted when status is confirmed.

### Flow B: Cancel booking
1. Client calls POST /bookings/:booking_id/cancel.
2. Service verifies caller is booking guest or booking host.
3. Service validates state transition (pending/confirmed -> cancelled).
4. Service updates booking row and releases booking_slots occupancy.
5. Service emits BOOKING_CANCELLED.

### Flow C: Reserved-slot export
1. listing-service calls GET /internal/listings/:space_id/reserved-slots.
2. booking-service validates internal token if configured.
3. booking-service returns reserved slot windows from active occupancy.

### Flow D: Payment confirmation event
1. booking-service subscribes to Redis events.
2. On PAYMENT_SUCCESS with booking_id, service updates booking status to confirmed.
3. BOOKING_CONFIRMED is emitted by status transition helper.

## 5. Data consistency and concurrency
- booking_slots has partial unique index on (space_id, slot_start_utc) where occupancy_status='active'.
- booking and slot writes are wrapped in a single transaction.
- cancellation marks occupancy_status='released' instead of deleting rows, preserving history.

## 6. Security boundaries
- External booking routes are JWT-protected through api-gateway.
- Internal reserved-slot route can be protected by X-Internal-Token.
- Per-resource authorization checks are applied for user/host ownership-sensitive operations.

## 7. Reliability and observability baseline
- Event publishing uses Redis pub/sub channel events.
- Payment and listing dependencies are fail-fast in strict flows.
- Logs include booking and service-level identifiers for traceability.

## 8. Known limitations
- No implemented review endpoint in current booking routes.
- No explicit completed/refunded transition APIs yet.
- Error payloads are simple { message } rather than structured error codes.
- Pagination/filter contract for list endpoints is not yet implemented.