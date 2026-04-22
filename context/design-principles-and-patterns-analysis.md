# Design Principles and Pattern Tradeoff Analysis

## 1. Purpose
This document provides a software-engineering focused analysis of design principles and implementation patterns for the hourly slot model in SpaceShare.

Scope:
- Listing subsystem (availability definition and slot timeline generation)
- Booking subsystem (slot reservation and lifecycle)

This analysis is intended to be final architecture guidance before implementation starts.

## 2. System Constraints Driving Design
1. Booking unit is fixed to 1 hour.
2. Hosts define recurring weekly hours and date overrides.
3. Guests must see calendar-style slot availability.
4. At scale targets, concurrency conflicts must be prevented deterministically.
5. Existing microservice boundaries must be preserved where practical.

## 3. Principle Analysis

### 3.1 Single Responsibility Principle (SRP)
Option A: Keep listing rules, slot generation, and reservation conflict handling in one service.
- Pros: fewer service calls, simpler local debugging.
- Cons: blurred ownership, harder independent scaling, larger blast radius.

Option B (Chosen): Keep listing-service responsible for schedule rules and booking-service responsible for occupancy.
- Pros: clear boundaries, easier testing by domain, independent scaling.
- Cons: requires composed read path and inter-service dependency.

Why chosen for this use case:
- The app already uses microservice boundaries by domain. SRP alignment reduces long-term complexity and supports assignment architecture goals.

### 3.2 Open/Closed Principle (OCP)
Option A: Hardcode pricing and cancellation logic in booking controller code.
- Pros: quick MVP coding.
- Cons: fragile to policy changes, high regression risk.

Option B (Chosen): Keep policy logic in dedicated pricing and cancellation modules (strategy-ready).
- Pros: policy changes isolated, easier A/B and plan-based evolution.
- Cons: slightly more initial structure.

Why chosen:
- Booking policy changes are expected as product evolves. OCP reduces rework and protects core flow stability.

### 3.3 Interface Segregation Principle (ISP)
Option A: Large shared service contract that exposes all listing and booking internals.
- Pros: fewer endpoints.
- Cons: tightly coupled clients and leaking internals.

Option B (Chosen): Small explicit contracts:
- listing-service consumes only reserved-slot export.
- booking-service consumes only listing snapshot fields needed for validation.

Why chosen:
- Keeps service interfaces minimal and stable while preventing accidental coupling.

### 3.4 Dependency Inversion Principle (DIP)
Option A: Controllers call axios/DB directly.
- Pros: fast to write.
- Cons: poor testability and high coupling to frameworks.

Option B (Chosen): Use adapter/repository abstractions for external calls and persistence.
- Pros: test doubles are easy, fallback logic centralized.
- Cons: more files and abstraction overhead.

Why chosen:
- Critical for reliable testing of slot conflict and timezone edge behavior.

### 3.5 High Cohesion and Low Coupling
Option A: Shared utility module with mixed concerns.
- Pros: less boilerplate.
- Cons: hidden dependencies and side effects.

Option B (Chosen): Cohesive modules:
- listing: schedule validation, slot generation, override precedence.
- booking: slot sequencing, conflict guard, lifecycle transitions.

Why chosen:
- Makes correctness-critical areas auditable and reduces accidental breakage.

### 3.6 DRY vs Intentional Duplication
Option A: Strict DRY across listing and booking for all time/slot logic.
- Pros: one place for logic.
- Cons: shared module coupling across services and deployment lockstep.

Option B (Chosen): Share only core primitives (format and validation contracts), keep domain rules local.
- Pros: service autonomy, safer deployments.
- Cons: minor duplicate code in utilities.

Why chosen:
- In microservices, excessive DRY can produce hidden distributed monoliths.

### 3.7 KISS and YAGNI
Option A: implement variable slot sizes, overnight windows, advanced queueing in MVP.
- Pros: future-ready.
- Cons: major complexity and longer stabilization period.

Option B (Chosen): fixed 60-minute slots, no overnight windows for MVP.
- Pros: predictable UX, simpler data model, faster convergence.
- Cons: less flexibility for edge hosts.

Why chosen:
- Aligns directly with project statement and reduces prototype risk.

### 3.8 Fail-Fast and Explicit Invariants
Option A: normalize invalid input implicitly.
- Pros: fewer client errors.
- Cons: hidden behavior and booking ambiguity.

Option B (Chosen): reject invalid slot/time payloads with explicit codes.
- Pros: deterministic behavior and easier debugging.
- Cons: stricter client requirements.

Why chosen:
- In reservation systems, silent normalization can create subtle double-booking defects.

## 4. Pattern Analysis and Decisions

### 4.1 State Machine Pattern
Applied to:
- listing lifecycle (draft/pending_review/active/etc.)
- booking lifecycle (pending/confirmed/cancelled/completed/refunded)

Alternative: boolean flags (is_active, is_cancelled, etc.)
- Pros: minimal schema change.
- Cons: contradictory states and transition bugs.

Chosen: explicit state machine.
- Why: transition validity and auditability are essential for bookings and moderation.

### 4.2 Strategy Pattern (Pricing and Cancellation)
Alternative: long if/else blocks per policy.
- Pros: simple MVP start.
- Cons: hard to evolve and test combinations.

Chosen: pluggable policy strategies.
- Why: enables plan-specific behavior and controlled rollout of policy changes.

### 4.3 Repository Pattern
Alternative: SQL in controllers/services directly.
- Pros: fewer files.
- Cons: duplication and difficult mocking.

Chosen: repositories for listing and booking persistence.
- Why: better testability and cleaner transactional orchestration.

### 4.4 Adapter Pattern
Alternative: direct HTTP calls inside business logic.
- Pros: fast initial coding.
- Cons: retry/timeout handling duplicated.

Chosen: adapter for listing snapshot and reserved-slot contracts.
- Why: resilience logic and contract translation stay centralized.

### 4.5 Composed Read Model Pattern
Alternative A: precompute and store all candidate slots.
- Pros: quick read responses.
- Cons: high write amplification and heavy maintenance.

Alternative B (Chosen): generate candidate slots from rules and overlay reservations on read.
- Pros: minimal storage and immediate schedule-change reflection.
- Cons: higher read compute, must cache aggressively.

Why chosen:
- Better fit for hourly coworking and changing host schedules.

### 4.6 Transaction Script vs Domain Service
Alternative: thin transaction scripts in controllers.
- Pros: quick MVP implementation.
- Cons: logic spread across handlers.

Chosen: domain services per critical flow (slot generation, reservation engine).
- Why: preserves invariants and supports thorough tests.

## 5. Tradeoff Summary by Concern
| Concern | Preferred Choice | Reason |
|---|---|---|
| Correctness under concurrency | booking_slots + unique active index | DB-level deterministic conflict protection |
| Flexibility vs simplicity | fixed 1-hour slots | simplicity wins for MVP |
| Consistency vs latency | composed read + caching | correctness with acceptable performance |
| Coupling vs speed | adapter/repository boundaries | maintainable and testable architecture |
| Evolution of policies | strategy modules | policy changes without rewiring core flow |

## 6. Guardrails for Implementation
1. Do not bypass slot alignment validation.
2. Keep all reservation writes in one DB transaction.
3. Keep day-of-week and timezone semantics consistent across services.
4. Avoid adding overnight windows until current invariants are stable.
5. Keep policy logic out of route handlers.

## 7. Prototype Scope Recommendation
Given assignment constraints, implement one end-to-end nontrivial functionality first:
- Host configures weekly schedule and one override.
- Guest fetches calendar timeline.
- Guest books contiguous slots.
- Slot visibility updates correctly after booking/cancellation.

This path demonstrates principles, patterns, and architectural reasoning with measurable NFR outcomes.