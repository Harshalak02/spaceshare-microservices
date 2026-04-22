# Listing System Architecture

Last synchronized with implementation: 2026-04-22

## 1. Scope
listing-service owns space metadata and host-configured availability rules for hourly bookings.

Current functional surface:
- space CRUD with owner controls.
- weekly availability management.
- date override management.
- slot timeline generation with reservation overlay from booking-service.
- helper endpoints for amenities and location assistance.

## 2. Bounded context ownership
- listing-service: metadata + schedule rules + slot generation orchestration.
- booking-service: reservation truth and occupied slots.
- api-gateway: JWT enforcement for /api/listings routes.

## 3. Implemented architecture components
1. Listing core component
- create/read/update/delete spaces and publish LISTING_* events.

2. Availability rules component
- listing_weekly_availability CRUD by owner.
- listing_availability_overrides CRUD by owner.

3. Slot generation engine
- derives day windows from override-first, weekly-fallback policy.
- converts listing timezone windows into UTC/local slot payload.

4. Reservation overlay adapter
- fetches reserved slots from booking-service internal endpoint.
- marks generated slots as reserved when overlap is present.

5. Slot caching component
- Redis cache-aside with listing/date-range keying and short TTL.

## 4. Runtime flows
### Flow A: Host updates weekly schedule
1. Owner calls PUT /spaces/:id/availability/weekly.
2. Service validates complete 7-day payload and time alignment.
3. Service stores weekly rows in transaction and updates listing timezone if provided.
4. Service invalidates slot cache for that listing.

### Flow B: Host manages date overrides
1. Owner calls PUT or DELETE override endpoint.
2. Service validates date and window semantics.
3. Service upserts/deletes override row.
4. Service invalidates slot cache.

### Flow C: Client reads slot timeline
1. Client calls GET /spaces/:id/slots with from/to.
2. Service checks cache.
3. On miss, service loads weekly + override rules.
4. Service requests reserved slots from booking-service internal API.
5. Service generates slots and applies reserved status overlay.
6. Service stores response in cache and returns payload.

## 5. Consistency model
- Schedule writes are strongly consistent in listing DB.
- Slot timeline is composed at read-time and cached.
- Current cache invalidation is triggered by listing mutations.
- Booking events do not currently trigger direct listing cache invalidation; freshness relies on short TTL.

## 6. Security boundaries
- Through gateway, all listing endpoints are authenticated.
- Within listing-service itself, owner-only writes are enforced by auth middleware + ownership checks.
- Helper/public route behavior exists at service layer but is typically consumed behind gateway auth.

## 7. Reliability and dependency behavior
- Reservation overlay call uses configurable HTTP timeout.
- Booking dependency errors propagate as slot endpoint failures.
- Cache unavailability does not bypass DB/booking logic but can increase latency.

## 8. Known limitations
- Slot statuses currently emitted as available or reserved only.
- No event-driven cache invalidation on BOOKING_CREATED/BOOKING_CANCELLED in listing-service.
- No support for overnight windows or variable slot duration in current implementation.