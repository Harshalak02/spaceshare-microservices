# Admin Dashboard Microservice Architecture (SpaceShare)

Date: 2026-04-24

## 1. Objective

Design Admin Dashboard as an independent microservice for platform governance and operations:

- listing moderation and approvals
- subscription oversight
- booking and payment dispute handling
- trust and safety actions
- platform analytics and health operations

## 2. Why a Separate Service

- Isolation of concerns: admin workflows are operational, not user journey workflows.
- Stronger security boundary: stricter authorization and audit requirements.
- Independent scaling: admin analytics and moderation spikes do not impact booking/search.
- Faster internal evolution: internal tooling can ship safely without touching user APIs.

## 3. Bounded Context

Admin Dashboard owns administration and governance orchestration.

In scope:

- admin command orchestration (approve, suspend, refund-trigger, flag)
- moderation queues and assignment
- admin read models for KPIs and operational summaries
- immutable audit records

Out of scope:

- booking domain rules (booking-service)
- listing source of truth (listing-service)
- payment processing core (payment-service)
- identity lifecycle (auth-service)

## 4. Architecture Style

Admin BFF + lightweight CQRS split.

- Write path (commands):
  Admin UI -> API Gateway -> admin-dashboard-service -> domain service APIs -> audit/event
- Read path (queries):
  domain events + periodic sync -> projection worker -> admin read models -> Admin UI

```text
[Admin Web UI]
      |
      v
[API Gateway] -- JWT/role checks --> [Auth Service]
      |
      v
[admin-dashboard-service]
   |         |             |
   |         |             +--> [Audit Store]
   |         +----------------> [Admin Read Store]
   |         +----------------> [Projection Worker]
   |
   +--> Integrations:
        - listing-service
        - booking-service
        - payment-service
        - subscription-service
        - notification-service
        - analytics-service
        - event bus/message broker
```

## 5. Key Components

1. Command Orchestrator

- validates role, policy, reason payload
- executes downstream commands with idempotency
- emits admin action events

2. Query Aggregator

- serves denormalized KPI and moderation views
- supports filtering, pagination, time windows

3. Governance Guardrails

- two-person approval for high-risk actions
- dry-run simulation for selected actions
- risk-tiered controls (low, medium, high)

4. Audit Module

- immutable append-only logs for all state-changing operations
- searchable by actor, action, entity, time window

## 6. API Surface (Illustrative)

Base path: /api/admin

- POST /auth/validate-session
- GET /overview/kpis?from=&to=
- GET /moderation/listings?status=pending
- POST /moderation/listings/{listingId}/approve
- POST /moderation/listings/{listingId}/reject
- POST /users/{userId}/suspend
- POST /payments/{paymentId}/initiate-refund
- POST /actions/{actionType}/dry-run
- POST /actions/{actionId}/approve-second-factor
- GET /audit/actions?actorId=&actionType=&from=&to=
- GET /health/summary

## 7. Data Design

Recommended split:

- operational DB: moderation cases, task assignment, policy configs
- read model DB/cache: KPI snapshots and dashboard projections
- audit store: append-only records (tamper-evident preferred)

Rule: admin service stores references and projections, not domain source of truth.

## 8. Security Model

- RBAC with scoped permissions (ADMIN_SUPER, ADMIN_MODERATOR, ADMIN_FINANCE)
- optional ABAC constraints (region/team)
- MFA and short-lived tokens
- step-up auth for high-risk actions
- strict audit trail and PII masking
- rate limiting and IP allow-list for admin endpoints

## 9. Reliability and Performance

Reliability:

- circuit breakers, retries with budgets, bulkheads
- outbox for reliable event publishing
- dead-letter queue for projection failures
- degraded read-only mode during dependency incidents

Targets:

- KPI page p95 < 1.2s (cached)
- moderation queue p95 < 800ms
- command acknowledgment p95 < 500ms (excluding async completion)

## 10. Observability

- structured logs: correlationId, adminId, actionType, targetEntity
- metrics:
  - admin_command_success_rate
  - moderation_backlog_size
  - projection_lag_seconds
  - dependency_error_rate
- alerts:
  - projection lag breach
  - audit-write failure
  - abnormal high-risk action spikes

## 11. ADR-Style Decisions

1. Dedicated admin microservice

- rationale: isolation, security, independent scaling
- trade-off: more integration complexity

2. Hybrid sync command + async projection reads

- rationale: responsive operations + fast dashboard reads
- trade-off: eventual consistency for some widgets

3. Immutable audit mandatory

- rationale: compliance and forensic traceability
- trade-off: extra write/storage overhead

4. Two-person approval for high-risk actions

- rationale: blast-radius control and insider-risk reduction
- trade-off: slower handling for selected operations

## 12. Industry-Informed Patterns (Publicly Known)

These are reference patterns aligned with public engineering narratives from global platforms like Airbnb and Booking.com, not claims about private internals.

- internal ops isolation from customer request paths
- event-driven projection models for dashboards
- strong trust/safety governance and auditable controls
- progressive rollout, feature flags, canaries
- graceful degradation during incidents

## 13. Student-Feasible Rollout

Phase 1:

- moderation + overview KPIs + immutable audit

Phase 2:

- dispute and refund orchestration + risk-tiered controls

Phase 3:

- advanced policy engine + anomaly detection + game-day runbooks

## 14. Success Criteria

- every admin action is traceable and queryable
- admin load does not degrade guest booking/search APIs
- KPI and moderation pages meet p95 targets
- unauthorized operations are blocked by policy
- projection lag remains within agreed operational SLO
