# Ratings and Reviews Service Architecture (SpaceShare)

Date: 2026-04-24

## 1. Scope and Goals

Build Ratings and Reviews as a separate microservice with these architectural goals:

- decoupling: isolated service/database so failures in other domains do not hide reviews
- read optimization: serve review widgets and listing pages at high read throughput
- verified integrity: only eligible users can submit ratings/reviews
- moderation and abuse control: protect quality and trust

## 2. Bounded Context Ownership

ratings-service owns:

- review lifecycle (create, edit window, soft delete)
- rating aggregates for entities (space, host)
- review moderation states (pending, approved, hidden)
- anti-spam and abuse flags

Other services own:

- booking completion truth (booking-service)
- user identity and roles (auth-service)
- listing source of truth (listing-service)

## 3. Architecture Style

Command and query separation with projection-based reads.

- Write path:
  user submits review -> eligibility check -> write review -> update aggregates -> invalidate cache -> emit event
- Read path:
  page requests ratings -> cache lookup -> fallback to read model/replica -> return aggregate + paged reviews

```text
[Frontend]
   |
   v
[API Gateway] -----> [ratings-service]
                       |        |        |
                       |        |        +--> [Redis Cache]
                       |        +-----------> [Read Replica / Projections]
                       +--------------------> [Primary DB]
                                  |
                                  +--> [Event Bus]

Eligibility checks from ratings-service:
- booking-service (completed stay/session)
- auth-service (user claims)
```

## 4. Data Layer Design

### 4.1 Logical Model

Core tables:

- reviews(review_id, entity_type, entity_id, author_id, booking_id, rating, text, status, created_at, updated_at)
- review_votes(review_id, voter_id, vote_type)
- review_moderation(review_id, state, reason, actor_id, acted_at)
- rating_aggregates(entity_type, entity_id, total_reviews, star_1..star_5, avg_rating, last_updated_at)
- eligibility_tokens(author_id, entity_id, booking_id, expires_at) optional cache table

### 4.2 Sharding by Entity ID (future-ready)

- shard key: hash(entity_type + entity_id)
- all reviews for one entity land in same shard
- keeps entity review reads local and predictable

Student prototype guidance:

- start single PostgreSQL instance
- implement shard-key abstraction in code now
- enable physical sharding later without API changes

### 4.3 Pre-computed Aggregations

- update rating_aggregates during write path (transactional update)
- avoid computing averages from raw rows on every read

Rationale:

- move heavy math from read path to write path
- consistently low-latency UI responses

## 5. Performance and Scalability Patterns

### 5.1 Layered Caching

- cache aggregate widget separately from review pages
- cache keys:
  - rating:agg:{entity_type}:{entity_id}
  - rating:reviews:{entity_type}:{entity_id}:page:{n}:sort:{mode}
- TTL strategy:
  - aggregates: 30-120 seconds
  - paged reviews: 15-60 seconds

### 5.2 Cache Invalidation

On successful write/moderation change:

- invalidate aggregate key
- invalidate first N hot pages for that entity

### 5.3 Consistent Hashing

Use consistent hashing in cache client ring (or managed Redis cluster feature) so node add/remove remaps fewer keys and avoids global miss storms.

Student prototype guidance:

- if using single Redis instance, document consistent-hashing upgrade path for cluster phase

## 6. High Availability Strategy

### 6.1 Primary and Replicas

- writes to primary DB
- read-heavy endpoints can use replicas
- failover runbook promotes replica if primary fails

### 6.2 Replication Mode

- asynchronous replication for better write responsiveness
- accept short replica lag; surface freshness timestamp

### 6.3 Multi-Zone Placement

- distribute replicas across zones for resilience
- maintain backups and restore drills for DR readiness

Student prototype guidance:

- single-zone acceptable initially
- require automated backups and restore test before demo release

## 7. Integrity and Trust Controls

Eligibility policy (minimum viable):

- user can review only if booking status = completed
- one review per booking per entity
- review window (for example 30 days after completion)

Abuse controls:

- rate limiting per account/IP
- profanity/spam heuristics
- moderation queue for risky submissions
- soft delete and appeal workflow

## 8. API Contract (Illustrative)

Base path: /api/ratings

Write APIs:

- POST /reviews
- PATCH /reviews/{reviewId}
- DELETE /reviews/{reviewId}
- POST /reviews/{reviewId}/report

Read APIs:

- GET /entities/{entityType}/{entityId}/aggregate
- GET /entities/{entityType}/{entityId}/reviews?page=&size=&sort=

Moderation APIs:

- POST /moderation/reviews/{reviewId}/approve
- POST /moderation/reviews/{reviewId}/hide

## 9. Workflow

### 9.1 Write Path

1. User submits review.
2. ratings-service validates auth and payload.
3. ratings-service validates booking completion via API/event-backed eligibility cache.
4. Write review to primary DB.
5. Update rating_aggregates in same transaction.
6. Invalidate affected cache keys.
7. Emit REVIEW_CREATED (or REVIEW_UPDATED/REVIEW_HIDDEN).

### 9.2 Read Path

1. UI requests aggregate and review page.
2. Service checks Redis.
3. On cache miss, read from replica/projection tables.
4. Return pre-computed aggregate + paginated reviews.
5. Backfill cache.

## 10. Design Choice Rationales

| Design Choice              | Rationale                                          | Benefit                                                  |
| -------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| Separate ratings-service   | isolates failures and release cycles               | reviews remain available even when other domains degrade |
| Pre-computed aggregates    | avoids expensive runtime calculations              | low-latency read path                                    |
| Cache + invalidation       | shields DB from read spikes                        | handles trending entities efficiently                    |
| Eligibility verification   | prevents fake/unqualified reviews                  | trust and quality of ratings                             |
| Primary-replica read split | aligns with read-heavy profile                     | scalable throughput                                      |
| Event publication          | decouples downstream consumers (search, analytics) | extensibility with low coupling                          |

## 11. Industry-Informed References (Public Patterns)

Aligned with publicly discussed marketplace/travel platform practices:

- decoupled review systems with strict eligibility checks
- read-model and cache-heavy serving path for listing pages
- moderation and trust/safety workflows for review quality
- asynchronous pipelines for downstream search/analytics consumption

These are reference patterns for architectural direction, not private implementation claims.

## 12. Feasibility for Student Prototype

Implement now:

- separate ratings-service with PostgreSQL + Redis
- eligibility check via booking-service API
- aggregate table maintained transactionally
- basic moderation states and admin endpoints

Defer to later:

- true physical DB sharding
- full ML spam classifier
- multi-region active-active setup

## 13. Success Metrics

- aggregate endpoint p95 < 150ms (cache hit)
- reviews endpoint p95 < 500ms for common page sizes
- duplicate/fake review rejection rate tracked
- moderation backlog and SLA monitored
- data freshness (replica/projection lag) visible in ops dashboard

## 14. Student-Feasible Implementation Plan

### 14.1 Objective

Deliver a realistic ratings/reviews microservice in the current prototype without over-engineering.

### 14.2 Tech Stack (Fit for Current Repo)

- Node.js + Express (consistent with existing services)
- PostgreSQL (service-owned schema)
- Redis (cache)
- REST integration with booking-service and auth-service
- optional event publish through existing event mechanism used in project

### 14.3 MVP Scope

1. Eligibility-verified review submission

- only completed booking can submit
- one review per booking

2. Read-optimized endpoints

- aggregate endpoint (avg + counts)
- paginated reviews endpoint

3. Transactional aggregate update

- update rating_aggregates in same DB transaction as review write

4. Basic moderation

- statuses: pending, approved, hidden
- admin hide/approve endpoints

5. Caching

- Redis cache-aside on aggregate and first review page
- invalidate keys on writes and moderation updates

### 14.4 Minimal Schema and Indexing

Tables:

- reviews
- rating_aggregates
- review_reports
- moderation_actions

Indexes:

- reviews(entity_type, entity_id, created_at)
- reviews(booking_id, author_id) unique
- rating_aggregates(entity_type, entity_id) unique

### 14.5 Delivery Phases

Phase 1 (1-2 days)

- service skeleton, DB schema, create/read endpoints
- booking completion validation call

Phase 2 (1 day)

- aggregate maintenance + Redis cache + invalidation
- basic tests for write/read paths

Phase 3 (1 day)

- moderation endpoints + reporting endpoint
- metrics and logs

Phase 4 (optional hardening)

- replica read routing
- event publication for analytics/search consumers

### 14.6 Risks and Mitigations

- booking-service dependency slow/unavailable:
  fail-closed eligibility check with timeout + retry budget
- cache inconsistency after writes:
  deterministic invalidation + low TTL fallback
- review spam:
  rate limits + report endpoint + moderation queue

### 14.7 Demo Acceptance Checklist

- cannot submit review without completed booking
- duplicate review for same booking is blocked
- aggregate endpoint reflects new review quickly
- cache hit/miss behavior visible in logs
- admin can hide review and it is excluded from default read path
- basic load test shows stable read latency with cache enabled
