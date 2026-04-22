# Booking System Detailed Design

Last synchronized with implementation: 2026-04-22

## 1. Design goals
1. Prevent duplicate reservations under concurrent create requests.
2. Keep slot payload canonical while preserving legacy compatibility.
3. Preserve payment and booking consistency by failing fast before DB commit.
4. Provide reservation truth to listing timeline generation.

## 2. Module design
### 2.1 Request validation and normalization
Responsibilities:
- validate space_id, slot_count, guest_count.
- validate start_slot_utc timestamp quality.
- enforce second=0 and millisecond=0 alignment.
- convert legacy start_time/end_time payload into start_slot_utc + slot_count.

### 2.2 Listing snapshot adapter
Responsibilities:
- fetch listing snapshot from listing-service.
- validate listing existence and basic booking eligibility.
- enforce guest_count <= capacity.
- snapshot price_per_hour and host/instant-book metadata.

### 2.3 Payment bridge adapter
Responsibilities:
- call payment-service before booking DB write path.
- support both strict and non-strict behavior through runtime config.
- return failure to create flow when strict payment fails.

### 2.4 Slot reservation engine
Responsibilities:
- expand contiguous slots from start_slot_utc + slot_count.
- persist booking row plus booking_slots rows in one transaction.
- rely on active-slot unique index for deterministic conflict handling.

### 2.5 Lifecycle and history module
Responsibilities:
- apply valid transitions using shared helper.
- append booking_status_history for transition audit.
- cancel flow writes cancellation metadata and releases occupancy rows.

### 2.6 Reservation export module
Responsibilities:
- return reserved slot windows for listing-service composition.
- support range filtering by from/to query params.

## 3. Create booking sequence (implemented)
1. Parse and validate request body.
2. Normalize canonical slot fields.
3. Fetch listing snapshot.
4. Compute pricing snapshot:
- subtotal = price_per_hour * slot_count
- platform_fee_amount currently 0
- tax_amount currently 0
5. Execute payment bridge call.
6. Begin transaction and insert bookings row.
7. Insert booking_slots rows for each hour.
8. On unique conflict, rollback and return conflict response.
9. On success, commit and emit BOOKING_CREATED.
10. Emit BOOKING_CONFIRMED when initial status is confirmed.

## 4. Cancel booking sequence (implemented)
1. Resolve booking by booking_id.
2. Validate caller authorization (guest or host).
3. Enforce allowed source states (pending or confirmed).
4. Update booking status and cancellation metadata.
5. Release booking_slots occupancy rows.
6. Record status history and emit BOOKING_CANCELLED.

## 5. Event-driven confirmation path
1. booking-service subscribes to PAYMENT_SUCCESS on Redis events channel.
2. On valid booking_id, updateBookingStatus(booking_id, confirmed) is invoked.
3. Transition helper emits BOOKING_CONFIRMED if status changed.

## 6. Endpoint behavior summary
- GET /bookings/my: caller bookings.
- GET /bookings/host/my: host bookings.
- GET /bookings/:user_id: self/admin only.
- POST /book: create booking.
- POST /bookings/:booking_id/cancel: cancel booking.
- GET /internal/listings/:space_id/reserved-slots: internal reservation export.

## 7. Security design
1. JWT enforced for external booking routes.
2. Ownership checks on user- and booking-scoped operations.
3. Internal endpoint supports X-Internal-Token guard.

## 8. Known design gaps
1. Review endpoint and review persistence are not implemented.
2. Completion and refund transitions are not exposed by API.
3. Error responses are message-based, not structured code/detail objects.
4. Pagination/filter query contract is not yet implemented for list endpoints.