# Listing System Implementation Roadmap (Hourly Slot Model)

## 1. Objective
Deliver host schedule management and guest slot timeline support for 1-hour booking intervals.

## 2. Phases
### Phase L1: Availability Foundation (1 week)
Deliverables:
- add timezone and availability tables
- weekly schedule endpoints
- override endpoints

Acceptance:
- host can configure 06:00 to 22:00 style daily windows

### Phase L2: Slot Timeline Engine (1 week)
Deliverables:
- slot generation module (60-minute fixed intervals)
- public slot timeline endpoint
- date-range limit enforcement

Acceptance:
- calendar API returns deterministic slots by date range

### Phase L3: Reservation Overlay Integration (4-5 days)
Deliverables:
- booking-service reserved-slot adapter
- composed availability response
- cache invalidation events wiring

Acceptance:
- booked slots disappear from guest slot timeline

### Phase L4: Performance and Hardening (4-5 days)
Deliverables:
- slot timeline caching
- load test and optimization
- error budgets and alerting hooks

Acceptance:
- cache hit under 500 ms, cache miss under 1.5 sec in test runs

### Phase L5: Frontend Calendar UX (1 week)
Deliverables:
- host weekly schedule UI
- override management UI
- guest calendly-like slot picker integration

Acceptance:
- full host setup and guest slot browsing workflow works end-to-end

## 3. Dependencies
- booking-service must expose reserved slots for listing/date range.
- gateway rate limiting and auth flow remains unchanged.

## 4. Risks
1. timezone handling bugs
- Mitigation: central timezone utility + DST tests

2. stale slot cache
- Mitigation: short TTL and booking event invalidation

3. inter-service dependency latency
- Mitigation: strict timeout budgets and retry policy

## 5. Milestone Checklist
- [ ] L1 availability schema and API done
- [ ] L2 slot engine done
- [ ] L3 reservation overlay done
- [ ] L4 NFR tuning done
- [ ] L5 frontend calendar flow done

## 6. Course Deliverable Mapping
- Task 1: subsystem and ASR coverage through slot model
- Task 2: stakeholder and ADR updates for schedule ownership
- Task 3: tactics and pattern implementation on availability engine
- Task 4: end-to-end nontrivial flow (host schedule -> guest slot view -> booking impact)