# Booking System Implementation Roadmap (Hourly Slot Model)

## 1. Objective
Deliver slot-safe hourly reservation flow with booking-platform behavior.

## 2. Phases
### Phase B1: Security and Contract Baseline (3-4 days)
Deliverables:
- protect all booking read endpoints
- define listing snapshot and reserved-slot internal contracts

Acceptance:
- no public user booking data exposure

### Phase B2: Slot-Based Create Flow (1 week)
Deliverables:
- create API supports start_slot_utc + slot_count
- request validation and contiguous slot expansion
- pricing by slot_count

Acceptance:
- successful hourly multi-slot booking flow

### Phase B3: Slot Occupancy Persistence (1 week)
Deliverables:
- booking_slots table and unique active slot index
- transactional booking + slot insert flow
- conflict-safe rollback path

Acceptance:
- no double booking under race tests

### Phase B4: Cancellation and Lifecycle (4-5 days)
Deliverables:
- cancel endpoint with status transition
- release slot occupancy on cancellation
- completion transition and review eligibility

Acceptance:
- cancelled bookings reopen slots for availability timeline

### Phase B5: Performance and Scale Hardening (4-5 days)
Deliverables:
- cache tuning for booking list reads
- load tests for 200 concurrent and 2000 peak users
- observability dashboards and alerts

Acceptance:
- latency targets achieved in test report

### Phase B6: Frontend and Calendar Integration (1 week)
Deliverables:
- frontend booking payload migration to slot_count model
- end-to-end with listing calendar slot selection

Acceptance:
- guest selects slots in calendar and booking succeeds end-to-end

## 3. Dependencies
- listing-service must deliver slot timeline from schedule + reserved slots.
- gateway auth and rate limiting apply to all booking routes.

## 4. Risks
1. high contention on popular times
- Mitigation: DB uniqueness + clear conflict UX messaging

2. migration complexity from legacy range payloads
- Mitigation: temporary compatibility mapping and phased deprecation

3. stale timeline due event delay
- Mitigation: event invalidation plus short cache TTL

## 5. Milestone Checklist
- [ ] B1 secure contract baseline done
- [ ] B2 slot create API done
- [ ] B3 slot occupancy safety done
- [ ] B4 lifecycle and cancellation done
- [ ] B5 NFR hardening done
- [ ] B6 frontend integration done

## 6. Course Deliverable Mapping
- Task 1: slot-based subsystem requirements and ASRs
- Task 2: updated stakeholder concerns and ADR decisions
- Task 3: tactics/patterns for concurrency and latency
- Task 4: nontrivial prototype path (calendar slot selection -> booking -> occupancy update)