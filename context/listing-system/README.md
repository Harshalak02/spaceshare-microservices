# Listing System Documentation Index

Last synchronized with implementation: 2026-04-22

This folder documents the listing subsystem that manages spaces, host availability, and slot timeline generation.

## Current implementation snapshot
- Listing CRUD is implemented with owner authorization.
- Availability rules are implemented via weekly schedule and date overrides.
- Slot timeline is generated dynamically from listing rules and booking reserved-slot overlay.
- Slot cache is implemented in Redis with short TTL.
- Compatibility/public helper endpoints are present: amenities, autocomplete, reverse geocode.
- Through api-gateway, all /api/listings routes are JWT-protected.

## Document map
1. architecture.md
- Runtime architecture, ownership boundaries, and consistency behavior.

2. design.md
- Module responsibilities, algorithms, validation rules, and endpoint behavior.

3. api-contracts.md
- Implemented contracts for CRUD, availability, slots, and helper endpoints.

4. data-model.md
- Current schema and indexes for spaces and availability tables.

5. nfr-and-tactics.md
- Performance, consistency, and security tactics in deployed design.

6. adrs.md
- Listing-specific architecture decisions and statuses.

7. testing.md
- Test coverage plan plus E2E validation checklist.

8. roadmap.md
- Completed and remaining listing milestones.

Cross-cutting references:
- ../design-principles-and-patterns-analysis.md
- ../architectural-tactics-tradeoff-analysis.md