# Listing System ADRs

Last synchronized with implementation: 2026-04-22

## ADR-L1: Fixed 60-Minute Slot Size
- Status: Accepted (implemented)
- Date: 2026-04-22

### Context
Current booking flow and UI are built around hourly reservations.

### Decision
Keep slot_minutes defaulted to 60 and generate hourly slots only.

### Consequences
Positive:
- simple validation and predictable slot payloads.

Negative:
- no 30-minute or custom-duration support.

## ADR-L2: Weekly Rules + Date Overrides
- Status: Accepted (implemented)
- Date: 2026-04-22

### Context
Hosts need repeatable schedule with per-date exceptions.

### Decision
Persist weekly defaults and date overrides in separate tables.

### Consequences
Positive:
- straightforward override precedence and efficient updates.

Negative:
- requires strict validation and complete-week payload discipline.

## ADR-L3: Listing Timezone as Canonical Schedule Zone
- Status: Accepted (implemented)
- Date: 2026-04-22

### Context
Host-defined local business hours must be interpreted consistently.

### Decision
Store timezone per listing and compute slot UTC/local values at read time.

### Consequences
Positive:
- host schedule semantics remain intuitive.

Negative:
- DST and timezone correctness become critical path logic.

## ADR-L4: Dynamic Slot Generation with Overlay
- Status: Accepted (implemented)
- Date: 2026-04-22

### Context
Persisting all future slots is storage-heavy and hard to maintain.

### Decision
Generate slots on demand from schedule rules and overlay reserved slots from booking-service.

### Consequences
Positive:
- no slot table explosion.

Negative:
- slot endpoint depends on booking-service and cache quality.

## ADR-L5: Gateway-Centric Access for Listing APIs
- Status: Accepted (implemented)
- Date: 2026-04-22

### Context
Deployment routes clients through api-gateway for auth consistency.

### Decision
Treat /api/listings routes as authenticated access path.

### Consequences
Positive:
- consistent JWT enforcement and shared policy point.

Negative:
- some service-level public routes are effectively private in gateway path.

## ADR-L6: TTL-Based Slot Cache Freshness
- Status: Accepted (implemented)
- Date: 2026-04-22

### Context
Slot generation is compute and dependency heavy under burst reads.

### Decision
Use Redis cache with short TTL and listing mutation invalidation.

### Consequences
Positive:
- reduced repeated generation cost.

Negative:
- reservation changes may remain stale until TTL expiry when no explicit invalidation event is consumed.