# Listing System Architecture Plan (Hourly Slot Model)

## 1. Scope
This plan defines a slot-first Listing architecture for SpaceShare, focused on small hourly bookings.

Product model:
- Bookings are in fixed 1-hour slots.
- Users can book multiple contiguous slots.
- Hosts define daily availability windows for each weekday (example: 06:00 to 22:00).
- Guests view available slots in a calendar-style UI.

## 2. Core Assumptions
1. Slot size is fixed at 60 minutes for MVP.
2. All availability is evaluated in listing timezone, then returned in UTC + display timezone.
3. Weekly schedule plus date overrides define supply.
4. Overnight windows (example 22:00 to 02:00) are out of MVP.
5. Search discovery keeps existing behavior; slot visibility is an additional read path.
6. Slot timeline range is capped (31 days in MVP) to protect performance.

## 3. Current State Gap Summary
Current listing-service supports only listing CRUD and basic metadata. Missing for slot-first design:
- No weekly availability model.
- No date override model.
- No timezone field on listing.
- No calendar slot query endpoint.
- No host schedule workflow.

## 4. Architecturally Significant Requirements
### Functional
1. Host can define opening and closing times for each weekday.
2. Host can add date-level overrides (closed day or special hours).
3. Guest can fetch available 1-hour slots for a date range.
4. Availability must reflect booked slots in near real time.

### Non-functional
1. Cache hit for slot queries under 500 ms.
2. Cache miss for slot queries under 1.5 sec.
3. 99.99% availability target for listing APIs.
4. Scalable to 500 baseline and 2000 peak users.

## 5. Bounded Context and Ownership
- Listing-service owns listing metadata and availability rules.
- Booking-service owns reservations and final occupancy.
- Slot availability for guest UI is a composed view:
  - listing rules from listing-service
  - booked slots from booking-service

## 6. Target Components
1. Listing Core Module
- Existing listing CRUD, lifecycle, moderation.

2. Availability Rules Module
- Weekly schedule per listing and weekday.
- Date-level overrides.

3. Slot Generation Module
- Generates 1-hour candidate slots for a date range from rules.

4. Slot Reconciliation Module
- Removes occupied slots using booking-service reserved slots.

5. Calendar Query API
- Returns slot timeline payload for Google Calendar / Calendly-like UI.

6. Cache Layer
- Redis cache for slot timeline responses and host schedule reads.

## 7. Runtime Flow
### Flow A: Host Configures Weekly Availability
1. Host updates weekly schedule for listing.
2. Listing-service validates window constraints.
3. Rules persist in DB.
4. Slot cache invalidated for affected listing/date windows.

### Flow B: Guest Loads Calendar Slots
1. Client calls slot timeline endpoint for listing and date range.
2. Listing-service loads weekly rules + overrides.
3. Listing-service fetches reserved slots from booking-service internal API.
4. Slot generator returns 1-hour available slots.
5. Response cached for short TTL.

### Flow C: Booking Created or Cancelled
1. Booking-service commits reservation.
2. Booking-service emits BOOKING_* event.
3. Listing-service (or cache invalidation worker) invalidates slot cache keys.

## 8. Availability Rule Model
For each listing:
- Monday to Sunday each has is_open, open_time_local, close_time_local.
- Date overrides support:
  - fully blocked date
  - custom open/close window for that date

Weekday mapping convention:
- day_of_week = 0..6 where 0=Sunday and 6=Saturday.

Priority order:
- date override first
- then weekly default

## 9. Calendar Response Shape
Slot payload fields:
- slot_start_utc
- slot_end_utc
- slot_start_local
- slot_end_local
- status: available | reserved | unavailable
- reason (optional)

## 10. Reliability and Consistency Strategy
- Source-of-truth consistency in listing DB for schedule rules.
- Eventual consistency for cache invalidation after bookings.
- Short TTL cache fallback to bound stale data risk.

## 11. Architectural Patterns and Tactics
Patterns:
- Rule-based schedule generation.
- Composed read model (availability rules + reservations).

Tactics:
- Cache-aside for slot timeline reads.
- Dependency timeout and fallback handling for booking-service queries.
- Structured observability on slot generation path.

## 12. Out of Scope for MVP
- Variable slot sizes.
- Overnight availability windows.
- Multi-timezone host schedules for a single listing.
- Recurrence exceptions beyond date-level override.