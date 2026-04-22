# SpaceShare Traceability Matrix

## Scope
This matrix maps high-level functional and non-functional requirements from `context/project-details.txt` and `context/project-guidelines.txt` to:
- design principles and patterns
- architectural tactics
- concrete service contracts
- implementation artifacts and validation scenarios

## Functional Requirements

| Requirement ID | Requirement | Architecturally Significant Concern | Principles / Patterns | Tactics | API / Contract Mapping | Implementation Mapping | Validation Scenario | Status |
|---|---|---|---|---|---|---|---|---|
| FR-1 | Host Subscription & Listing | Host-owned listing lifecycle and availability definition | SRP, ISP, State Machine, Repository | Defense in depth, query bounding | `PUT /spaces/:id/availability/weekly`, `PUT /spaces/:id/availability/overrides`, `GET /spaces/:id/slots` | `listing-service/src/controllers/listingController.js`, `listing-service/src/services/listingService.js`, `listing-service/schema.sql` | Host updates weekly hours and override; guest sees updated slots | In progress |
| FR-2 | Space Discovery & Search | Fast and filtered listing lookup with bounded latency | SRP, High cohesion, Repository | Cache-aside, bounded queries, stateless scale-out | `GET /spaces`, `GET /search/*` via API gateway | `search-service/src/services/searchService.js`, `api-gateway/src/routes/gatewayRoutes.js` | Search by date/location/capacity and check latency vs cache hit/miss targets | Partial |
| FR-3 | Booking & Slot Management | Conflict-safe slot reservation under concurrency | Fail-fast invariants, OCP, Strategy-ready pricing, State Machine | DB-level unique slot constraint, transactions, timeout-bounded service calls | `POST /book`, `POST /bookings/:booking_id/cancel`, `GET /internal/listings/:space_id/reserved-slots` | `booking-service/src/services/bookingService.js`, `booking-service/src/controllers/bookingController.js`, `booking-service/schema.sql` | 2 concurrent requests for same slot produce 1 success + 1 conflict | In progress |
| FR-4 | Reviews & Ratings | Post-booking trust and quality feedback | OCP, ISP | Query bounding, authz defense in depth | Planned review endpoints | Not yet implemented | Create rating after completed booking, aggregate on listing profile | Planned |
| FR-5 | Admin Dashboard | Cross-service moderation, subscription and analytics visibility | SRP, Adapter, Composed read model | Structured telemetry, stateless scaling | Planned admin endpoints and analytics views | `analytics-service`, `subscription-service`, `notification-service` foundations present | Admin can monitor listing/booking/subscription KPIs and platform health | Planned |

## Non-Functional Requirements

| Requirement ID | NFR Target | Design / Tactic Mapping | Architecture / Contract Mapping | Measurement Method | Current State |
|---|---|---|---|---|---|
| NFR-1 | Availability consistency 99.99% | Stateless services, health endpoints, bounded dependency timeouts, DB conflict invariants | `GET /health` across services, transactional booking writes, slot uniqueness constraint | Uptime % from service health probes and error budgets | Partial (health endpoints present, SLO instrumentation pending) |
| NFR-2 | Performance: cache hit < 500 ms, cache miss < 1.5 sec | Cache-aside for slots/search, bounded slot-range queries, on-demand slot generation with reservation overlay | `listing-service` slot cache key strategy, `search-service` Redis cache | p50/p95 latency test for `GET /spaces/:id/slots` and search endpoints | In progress |
| NFR-3 | Security: JWT expiry 24h | Defense in depth (gateway + service middleware), ownership checks, internal token for service-to-service route | `auth-service` JWT issuance, service `authMiddleware`, booking internal token route guard | Verify unauthorized access blocked; token expiry and claims behavior | In progress |
| NFR-4 | Concurrency: 200 simultaneous requests | DB-level unique active slot index + transaction script for booking creation | `booking_slots` partial unique index and transactional inserts | Load test `POST /book` at 200 concurrency on same and mixed slots | In progress |
| NFR-5 | Scalability: 500 baseline, 2000 peak users | Microservice decomposition, stateless horizontal scaling, Redis caching, query bounds | Docker-compose topology, service-specific APIs, pub/sub event channel | Throughput and response-time profiling under baseline/peak loads | In progress |

## Architectural Decision Linkage

| Decision Theme | Chosen Option | Rationale | Source Document |
|---|---|---|---|
| Slot representation | Fixed 60-minute slots | Simplifies invariants and UI timeline behavior for MVP | `context/listing-system/architecture.md`, `context/booking-system/architecture.md` |
| Availability modeling | Weekly recurring schedule + date overrides | Balances host flexibility and deterministic generation logic | `context/listing-system/design.md`, `context/listing-system/data-model.md` |
| Conflict handling | DB unique active slot constraint | Strongest correctness under concurrency | `context/booking-system/design.md`, `context/booking-system/data-model.md` |
| Cross-service slot visibility | Listing generates candidates, booking exports reserved slots | Clear ownership and low coupling | `context/listing-system/api-contracts.md`, `context/booking-system/api-contracts.md` |
| Policy extensibility | Strategy-ready pricing/cancellation flow | Supports future policy changes without rewriting core transaction path | `context/design-principles-and-patterns-analysis.md` |

## Test Traceability (Core End-to-End Path)

| Test ID | Requirement Coverage | Scenario | Expected Result |
|---|---|---|---|
| T-E2E-1 | FR-1, FR-3, NFR-2 | Host sets weekly availability + override, guest requests slots in range | Slot timeline generated in listing timezone and respects override precedence |
| T-E2E-2 | FR-3, NFR-4 | Two guests attempt same `start_slot_utc` concurrently | One booking succeeds; other receives conflict error |
| T-E2E-3 | FR-3, NFR-2 | Cancel confirmed booking and query slots again | Cancel releases occupancy and slot appears available |
| T-E2E-4 | NFR-3 | Access `/bookings/:user_id` with different user token | Request denied with `403 Forbidden` |
| T-E2E-5 | NFR-2, NFR-5 | Repeat slot query for same listing/date window | First request cache miss slower; repeated requests cache hit faster |

## Notes
- This matrix is intentionally implementation-oriented for Project 3 Task 4, so each requirement has a direct engineering and validation path.
- Reviews/Ratings and Admin Dashboard are mapped as planned scope with partial foundational services present.
