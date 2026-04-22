# Booking System Test Plan (Hourly Slot Model)

## 1. Test Objectives
1. Validate slot-based create/cancel lifecycle.
2. Prove no double-booking under concurrent requests.
3. Validate reservation export for listing slot timeline.
4. Verify NFR latency and reliability goals.

## 2. Unit Tests
Targets:
- start_slot_utc alignment validation
- contiguous slot expansion
- pricing by slot_count
- state transition guards

Examples:
- start at 10:00 with slot_count 3 yields 10-13 window
- start at 10:30 rejected
- slot_count 0 rejected

## 3. Integration Tests
1. Create booking inserts booking row and N slot rows.
2. Duplicate slot request conflicts and rolls back.
3. Cancel booking releases active occupancy.
4. /internal/listings/:id/reserved-slots returns expected occupied windows.

## 4. Concurrency Tests
### Hot slot race
- fire 200 parallel create requests for same listing and start slot.
- expected: 1 success, others BOOKING_CONFLICT.

### Multi-slot overlap race
- request [10-13] versus [11-12] parallel.
- expected: exactly one request path succeeds.

## 5. Contract Tests
1. listing snapshot contract from listing-service.
2. reserved-slot export contract to listing-service.
3. event payload contract for notification and analytics consumers.

## 6. End-to-End Tests
1. Guest views available slots and books 2 contiguous slots.
2. Slot becomes unavailable in listing calendar.
3. Guest cancels and slot becomes available again.
4. Booking completes and review submission succeeds.

## 7. Performance and Load Tests
Scenarios:
1. 200 concurrent create attempts on hot slot.
2. 2000 virtual users mixed reads/writes.

Success criteria:
- no double-booking in data
- cache hit p95 < 500 ms
- cache miss p95 < 1.5 sec

## 8. Security Tests
1. protected booking list endpoints cannot be read by other users.
2. host-only booking endpoints validate listing ownership.
3. internal reserved-slot endpoint restricted by service trust policy.

## 9. Reliability Tests
1. listing-service dependency timeout handling on create.
2. Redis publish failure should not corrupt committed booking data.
3. DB restart scenario recovery.

## 10. Regression Suite
Must always pass:
- create booking
- conflict booking
- cancel booking
- get my bookings
- reserved-slot export

## 11. Exit Criteria
1. slot conflict safety proven in race tests.
2. security gap on user-specific reads fully closed.
3. slot timeline integration contract validated with listing-service.