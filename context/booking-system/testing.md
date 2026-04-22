# Booking System Testing Guide

Last synchronized with implementation: 2026-04-22

## 1. Test objectives
1. Validate create/conflict/cancel lifecycle for slot-based bookings.
2. Validate payment-to-booking integration behavior.
3. Validate reservation export contract consumed by listing-service.
4. Prevent regressions in auth and ownership checks.

## 2. Unit test focus areas
- request validation and payload normalization.
- slot_count expansion and derived end slot logic.
- status transition guard behavior.
- cancellation metadata and slot release helper logic.

Representative cases:
- slot_count must be positive integer.
- malformed start_slot_utc rejected.
- legacy range payload converts correctly to slot_count.

## 3. Integration test scenarios
1. Create booking writes bookings + booking_slots rows.
2. Conflicting create request fails with 409 conflict semantics.
3. Cancel booking transitions to cancelled and releases active occupancy.
4. Internal reserved-slot endpoint returns active reservations in range.
5. PAYMENT_SUCCESS event updates status to confirmed when applicable.

## 4. Security test scenarios
1. /bookings/:user_id only accessible by self or admin.
2. cancel allowed only for booking guest or host.
3. internal endpoint rejects missing/invalid internal token when configured.

## 5. Contract test scenarios
1. listing snapshot read contract from listing-service.
2. reserved-slot response contract to listing-service.
3. BOOKING_CREATED / BOOKING_CONFIRMED / BOOKING_CANCELLED event payload shape.

## 6. End-to-end validation performed in current cycle
Validated flows:
- register and login
- add listing
- search listings and load slots
- create booking
- booking conflict check
- payment session path
- cancel booking and slot release

Validation notes:
- Payment completion simulation was used; real provider settlement was intentionally excluded.
- Notification flow was excluded from final requested E2E scope.

## 7. Performance and resilience test backlog
Planned:
1. 200 parallel creates on same slot to assert one winner and deterministic conflicts.
2. mixed 2000-user synthetic workload for p95 latency baselining.
3. dependency failure matrix (listing timeout, payment error, Redis publish failure).

## 8. Regression suite minimum
Must remain green:
- POST /book
- POST /bookings/:booking_id/cancel
- GET /bookings/my
- GET /bookings/host/my
- GET /internal/listings/:space_id/reserved-slots

## 9. Known testing gaps
1. No repository-checked load-test report artifact yet.
2. No implemented review endpoint to include in regression.
3. Completion/refund lifecycle not covered because API not implemented.