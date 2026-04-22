# Listing System Detailed Design

Last synchronized with implementation: 2026-04-22

## 1. Design goals
1. Keep host schedule authoring simple and deterministic.
2. Generate slot timeline accurately across timezones.
3. Reconcile schedule with reservations without duplicating booking ownership.
4. Preserve backward compatibility with existing listing CRUD flow.

## 2. Module design
### 2.1 Space management module
Responsibilities:
- create/update/delete spaces with owner checks.
- validate required fields and positive numeric constraints.
- validate timezone values on create/update.

### 2.2 Weekly availability module
Responsibilities:
- enforce full 7-day payload for upsert.
- enforce hour-aligned open and close times for open days.
- persist one row per day via upsert semantics.

### 2.3 Override module
Responsibilities:
- upsert date-specific windows or closed-all-day flags.
- validate date format and time semantics.
- delete override to return to weekly-default behavior.

### 2.4 Slot generation module
Inputs:
- listing timezone
- weekly rules map by day_of_week
- override map by date_local
- reserved slot set from booking-service
- query range [from, to]

Algorithm:
1. Validate date range and enforce max 31 days.
2. For each date, choose window by override-first then weekly-fallback rule.
3. Build one-hour slot boundaries in listing timezone.
4. Convert slot boundaries to UTC and local timestamps.
5. Mark slot status:
- reserved if slot_start_utc appears in reserved-set
- available otherwise
6. Apply include_unavailable filter:
- false: keep available only
- true: include available and reserved

### 2.5 Booking overlay adapter
Responsibilities:
- call booking internal reserved-slot API with timeout.
- pass X-Internal-Token when configured.
- propagate dependency errors to caller when fetch fails.

### 2.6 Cache module
Cache key format:
- slots:listing:{id}:from:{from}:to:{to}:all:{0|1}

TTL:
- SLOT_CACHE_TTL_SECONDS (default 30)

Invalidation:
- on listing update/delete.
- on weekly availability and override changes.

## 3. Endpoint behavior
### Weekly availability
- GET returns timezone, slot_minutes, and sorted week rows.
- PUT replaces all weekdays in one call.

### Date overrides
- GET returns overrides optionally filtered by from/to.
- PUT upserts one override by date_local.
- DELETE removes one override by override id.

### Slots
- GET /spaces/:id/slots requires from and to.
- returns listing_id, timezone, slot_minutes, from, to, and slots.

## 4. Security and policy
1. Owner-only mutations for listing and availability endpoints.
2. Through gateway deployment path, listing routes are JWT-protected.
3. Service-direct public helper endpoints exist but are not the primary client path.

## 5. Error and recovery behavior
- validation errors return 400 with message and error details.
- owner mismatch returns 403.
- unknown listing returns 404.
- dependency failures on reserved-slot fetch surface as slot read failure.

## 6. Known design gaps
1. No explicit event-driven slot-cache invalidation on booking events in listing-service.
2. No overnight window support.
3. Slot status currently limited to available/reserved in emitted payload.