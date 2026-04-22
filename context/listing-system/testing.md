# Listing System Testing Guide

Last synchronized with implementation: 2026-04-22

## 1. Test objectives
1. Validate listing CRUD and ownership behavior.
2. Validate weekly schedule and override correctness.
3. Validate slot timeline generation and reservation overlay.
4. Validate integrated booking effect on slot visibility.

## 2. Unit test focus areas
- timezone validation and normalization helpers.
- hour-aligned time validation.
- weekly full-payload (0..6) enforcement logic.
- override precedence over weekly schedule.
- slot generation boundary logic for date ranges.

## 3. Integration test scenarios
1. Weekly availability upsert stores seven day rows.
2. Override upsert/delete updates daily behavior correctly.
3. Slot endpoint enforces range and date validation.
4. Reserved-slot overlay marks generated slots as reserved.
5. include_unavailable=false filters reserved slots out.
6. include_unavailable=true returns available and reserved slots.

## 4. Security test scenarios
1. Non-owner cannot update/delete listing or availability.
2. Owner can read and update weekly/override endpoints.
3. Gateway path requires auth for listing route family.

## 5. Contract test scenarios
1. booking reserved-slot API compatibility.
2. slot payload shape consumed by frontend search/booking flow.
3. listing CRUD event payload shape (LISTING_CREATED/UPDATED/DELETED).

## 6. End-to-end validation performed in current cycle
Validated:
- register/login
- host listing creation
- search and slot read
- booking from slot selection
- booking conflict handling
- cancellation and slot re-availability after refresh

Scope note:
- final requested E2E cycle excluded notification feature validation.

## 7. Performance and reliability backlog
Planned:
1. stress test 200 concurrent slot reads for same listing/date range.
2. mixed workload benchmark with search plus slot reads.
3. timeout/failure-path tests when booking-service is unavailable.

## 8. Regression suite minimum
Must remain green:
- GET /spaces
- GET /spaces/:id
- GET /spaces/:id/slots
- GET/PUT /spaces/:id/availability/weekly
- GET/PUT/DELETE /spaces/:id/availability/overrides

## 9. Known testing gaps
1. no event-driven cache invalidation test for booking events (not implemented in listing-service).
2. no committed load-test report artifact in repository docs.