# Listing System Test Plan (Hourly Slot Model)

## 1. Test Objectives
1. Verify weekly schedule and override correctness.
2. Verify accurate 1-hour slot timeline generation.
3. Verify reservation overlay correctness.
4. Validate NFR targets for slot timeline reads.

## 2. Unit Tests
Targets:
- schedule validation (open < close, hour alignment)
- override precedence
- timezone conversion helpers
- slot splitting into 60-minute boundaries

Examples:
- 06:00 to 10:00 generates exactly 4 slots
- closed_all_day override yields zero slots
- invalid 06:30 start rejected

## 3. Integration Tests
Targets:
- weekly schedule CRUD
- override upsert/delete
- slot timeline endpoint with mocked reservation overlay

Examples:
- weekly open schedule returns expected slots
- override on one date replaces weekly window
- reservation overlay marks slots unavailable

## 4. Contract Tests
1. listing-service <-> booking-service reserved slot contract.
2. event-driven cache invalidation contract on BOOKING_CREATED/CANCELLED.

## 5. End-to-End Tests
1. Host sets weekday windows in UI.
2. Guest opens calendar and sees slots.
3. Guest booking removes the slot from next calendar fetch.
4. Guest cancellation reopens slot after invalidation/TTL.

## 6. Performance and Load Tests
Scenarios:
1. 200 concurrent slot timeline requests on same listing.
2. Mixed load: search + slot reads for 2000 virtual users.

Success criteria:
- cache hit p95 under 500 ms
- cache miss p95 under 1.5 sec

## 7. Reliability Tests
1. booking-service overlay timeout handling.
2. cache unavailable fallback behavior.
3. DB fail/recover behavior for schedule endpoints.

## 8. Security Tests
1. non-owner cannot update schedule.
2. guest can read slots only for active listing.
3. invalid timezone/date inputs rejected.

## 9. Regression Suite
Must always pass:
- existing listing CRUD
- schedule update and read
- slot timeline generation
- slot timeline after booking event invalidation

## 10. CI Gates
1. Unit + integration pass.
2. Contract test pass for reserved-slot adapter.
3. Coverage goals:
- slot engine >= 90%
- schedule validation >= 90%

## 11. Exit Criteria
1. Host schedule setup is stable and validated.
2. Guest slot view is correct and timezone-safe.
3. Performance SLO targets are met on test workloads.