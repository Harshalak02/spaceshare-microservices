# Booking System Roadmap and Status

Last synchronized with implementation: 2026-04-22

## 1. Objective
Keep booking flow stable and conflict-safe while completing remaining lifecycle and quality gaps.

## 2. Phase status
### Phase B1: Security and route baseline
Status: Completed

Delivered:
- JWT-protected booking routes through gateway.
- Ownership checks for sensitive reads and cancel operations.
- Internal reserved-slot endpoint token guard support.

### Phase B2: Slot-based create flow
Status: Completed

Delivered:
- start_slot_utc + slot_count create path.
- legacy start_time/end_time compatibility mapping.
- pricing snapshot columns persisted with booking.

### Phase B3: Slot occupancy persistence and conflict control
Status: Completed

Delivered:
- booking_slots table with active unique slot index.
- transactional booking + slot writes.
- deterministic conflict rollback path.

### Phase B4: Cancellation lifecycle
Status: Completed (core), Partial (extended lifecycle)

Delivered:
- cancel endpoint implemented.
- status transition and cancellation metadata persistence.
- slot occupancy release on cancel.

Remaining:
- explicit completion/refund API transitions.
- review flow activation.

### Phase B5: Payment integration hardening
Status: Completed (baseline)

Delivered:
- booking create payment bridge integration.
- PAYMENT_SUCCESS event handling to confirm booking status.
- idempotency-safe payment create-session behavior on already-paid booking (in payment-service).

Remaining:
- expanded failure policy matrix and retry telemetry.

### Phase B6: E2E and UI integration
Status: Completed (current cycle)

Delivered:
- end-to-end flow validated: register/login/add listing/search/slots/booking/conflict/payment/cancel/release.
- frontend booking success notice persistence improved after slot refresh.

## 3. Current dependencies
- listing-service for listing snapshot on create.
- payment-service for charge/session processing.
- Redis for event publish/subscribe integration.
- api-gateway for JWT enforcement.

## 4. Near-term backlog
1. Add review endpoint and review storage model.
2. Add completion transition API and automated completion scheduler.
3. Add structured error codes across booking APIs.
4. Add formal load-test artifact in docs.

## 5. Milestone checklist
- [x] B1 security baseline
- [x] B2 slot create path
- [x] B3 slot occupancy conflict safety
- [x] B4 cancel and slot release
- [x] B5 payment bridge baseline
- [x] B6 integrated E2E validation

## 6. Course deliverable mapping
- Task 1: subsystem requirements and ASRs represented by slot-safe booking model.
- Task 2: ADR and stakeholder updates captured in folder docs.
- Task 3: concurrency and reliability tactics implemented through DB/index/transaction design.
- Task 4: non-trivial prototype path validated end-to-end with real services.