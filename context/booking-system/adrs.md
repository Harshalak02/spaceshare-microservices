# Booking System ADRs (Hourly Slot Model)

## ADR-B1: Booking Request Uses start_slot_utc Plus slot_count
- Status: Proposed
- Date: 2026-04-22

### Context
Range-based start/end inputs are less explicit for fixed 1-hour booking UX.

### Decision
Primary create API will use start_slot_utc and slot_count.

### Consequences
Positive:
- explicit slot semantics
- simpler validation and pricing

Negative:
- client migration needed for older payload format

## ADR-B2: Persist Slot Occupancy in booking_slots Table
- Status: Proposed
- Date: 2026-04-22

### Context
App-level overlap checks can fail under high concurrency if not hardened.

### Decision
Use booking_slots rows with active unique index on (space_id, slot_start_utc).

### Consequences
Positive:
- strong DB-level conflict guarantee
- deterministic race outcomes

Negative:
- additional write amplification (one row per slot)

## ADR-B3: Require Contiguous Multi-Slot Bookings in MVP
- Status: Proposed
- Date: 2026-04-22

### Context
Calendly-like UX is simpler with contiguous selection.

### Decision
slot_count always expands to contiguous slots from start slot.

### Consequences
Positive:
- easier UX and simpler backend logic

Negative:
- cannot create disjoint multi-window booking in one request

## ADR-B4: Expose Reserved Slots via Internal Booking Endpoint
- Status: Proposed
- Date: 2026-04-22

### Context
Listing-service needs reservation occupancy to render availability timeline.

### Decision
Provide internal endpoint for reserved slots by listing and date range.

### Consequences
Positive:
- clear service boundary
- listing calendar remains accurate

Negative:
- introduces read dependency from listing-service to booking-service

## ADR-B5: Keep Booking Platform Features with Hourly Semantics
- Status: Proposed
- Date: 2026-04-22

### Context
Product should still feel like a booking platform, just hourly.

### Decision
Retain lifecycle, cancellation/refund policy, and post-completion reviews.

### Consequences
Positive:
- consistent business behavior across platform

Negative:
- policy and test complexity increases