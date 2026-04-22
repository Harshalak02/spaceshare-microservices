# Listing System ADRs (Hourly Slot Model)

## ADR-L1: Fixed 60-Minute Slot Size for MVP
- Status: Proposed
- Date: 2026-04-22

### Context
Product focus is small coworking bookings, not overnight stays.

### Decision
Use fixed 1-hour slots for all listings in MVP.

### Consequences
Positive:
- simpler UX and backend validation
- easier conflict handling

Negative:
- less flexible for hosts wanting 30-minute slots

## ADR-L2: Weekly Availability Plus Date Overrides
- Status: Proposed
- Date: 2026-04-22

### Context
Hosts need repeating daily windows and occasional exceptions.

### Decision
Store weekday defaults and date-specific overrides as separate tables.

### Consequences
Positive:
- expressive enough for real operations
- efficient updates without full calendar rewrites

Negative:
- precedence logic must be explicit and tested

## ADR-L3: Listing-Timezone Canonical Scheduling
- Status: Proposed
- Date: 2026-04-22

### Context
Hosts define hours in local time; guests may be in different timezones.

### Decision
Store schedule in listing timezone and convert to UTC for API payloads.

### Consequences
Positive:
- host setup is intuitive
- avoids ambiguity in rule definition

Negative:
- timezone conversion complexity, especially DST edges

## ADR-L4: Dynamic Slot Generation Instead of Persisted Slot Table
- Status: Proposed
- Date: 2026-04-22

### Context
Persisting all future hourly slots can create large storage and maintenance overhead.

### Decision
Generate candidate slots on read from weekly rules + overrides, then overlay reservations.

### Consequences
Positive:
- smaller storage footprint
- immediate reflection of rule changes

Negative:
- higher compute on read path
- requires caching to meet latency targets

## ADR-L5: Availability View as Composed Read Model
- Status: Proposed
- Date: 2026-04-22

### Context
Listing-service owns schedule rules, booking-service owns occupancy.

### Decision
Slot endpoint composes availability using listing rules and booking reserved slots.

### Consequences
Positive:
- clean domain ownership
- reusable booking engine

Negative:
- inter-service dependency on slot read path
- requires timeout and fallback strategy