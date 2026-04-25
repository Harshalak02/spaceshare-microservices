# SpaceShare — Co-Working Space Marketplace (Microservices)

A production-grade microservices system for a co-working space marketplace built with **Node.js**, **React**, **PostgreSQL**, and **Redis**. SpaceShare lets hosts list their spaces and guests discover, book, and pay for them — all through an API Gateway that routes requests to independently deployable services.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Frontend | React + Vite |
| Databases | PostgreSQL (one DB per service) |
| Cache / Pub-Sub | Redis (ioredis) |
| Auth | JWT + bcrypt |
| Payments | Adapter pattern — Mock (default) or Stripe |
| Containerisation | Docker + Docker Compose |

---

## Architecture Overview

```
┌───────────────┐
│   Frontend    │ :5173 (React + Vite)
└──────┬────────┘
       │
┌──────▼────────┐
│  API Gateway  │ :4000  ── rate limiting, correlation IDs, auth, health aggregation
└──────┬────────┘
       │  REST
       ├──────────── Auth Service          :4001
       ├──────────── Listing Service       :4002
       ├──────────── Search Service        :4003
       ├──────────── Booking Service       :4004
       ├──────────── Subscription Service  :4005
       ├──────────── Notification Service  :4006
       ├──────────── Analytics Service     :4007
       └──────────── Payment Service       :4008
```

Each service owns its **own PostgreSQL database** and `schema.sql`, enforcing bounded contexts — services communicate exclusively via REST APIs and Redis pub/sub.

---

## Services

### API Gateway (`:4000`)
- Routes all `/api/*` requests to the appropriate downstream service
- **Sliding-window rate limiting** — global (120 req/min), auth (20/min per IP), booking writes (10/min per user)
- **Correlation ID** (`x-correlation-id`) generated per request for distributed tracing
- **Aggregated health endpoint** (`GET /health`) — pings all downstream services and reports their status
- JWT validation middleware on protected routes

### Auth Service (`:4001`)
- User registration and login with role support (`guest`, `host`, `admin`)
- Password hashing via **bcrypt**
- JWT generation (1-day expiry) and token validation
- User lookup by ID (`GET /users/:id`)

### Listing Service (`:4002`)
- Full CRUD for co-working spaces (title, description, location, lat/lon, price, capacity, images, timezone)
- **Weekly availability schedule** — 7-day recurring windows with hour-aligned open/close times
- **Date-specific overrides** — close or change hours for individual dates
- **Slot generation** — computes hourly slots in the listing's timezone, cross-references reserved slots from the Booking Service
- **Subscription-based listing limits** — enforced via **Strategy Pattern** (`FreePlan`, `BasicPlan`, `ProPlan`)
- Redis cache invalidation on availability changes
- Publishes `LISTING_CREATED`, `LISTING_UPDATED`, `LISTING_DELETED` events

### Search Service (`:4003`)
- **Geo bounding-box** pre-filter on `lat`/`lon` with configurable radius
- Filters: price range, minimum capacity, text search (title, location, description)
- Sorting: distance, price (asc/desc), capacity, newest
- **Pagination** with configurable page size (max 100)
- **Redis cache** with configurable TTL (`CACHE_TTL_SECONDS`, default 300s)

### Booking Service (`:4004`)
- Create bookings with **slot-level availability checks** (unique index prevents double-booking)
- **State Machine** — explicit transition map (`pending → confirmed → completed / cancelled`; `pending → expired`)
- **Booking slots table** — per-hour granularity with `active`/`released` occupancy tracking
- **Status history audit trail** — logs every state transition with actor and reason
- **Payment window** — bookings start as `pending`; stale unpaid bookings are auto-cleaned
- **Idempotency keys** — prevents duplicate booking creation
- **Circuit Breaker** — wraps Listing Service calls with fail-fast on sustained failures (CLOSED → OPEN → HALF_OPEN)
- **Retry with exponential backoff** — retries transient failures (skips 404s)
- **Transactional Outbox** — events written within the same DB transaction, polled and published by a background worker
- **Paginated queries** for user and host booking lists
- Cancel and delete operations with slot release and refund tracking
- Internal endpoints for payment confirmation and reserved-slot queries

### Payment Service (`:4008`)
- **Adapter Pattern** — pluggable payment providers (`MockAdapter` for dev, `StripeAdapter` for production)
- Payment session management with configurable window
- Webhook handling — updates payment status and confirms booking
- Publishes `PAYMENT_SUCCESS` events via Redis
- Internal service token auth for booking confirmation callbacks

### Subscription Service (`:4005`)
- Three-tier plan system: **Free** (2 listings), **Basic** (5 listings), **Pro** (10 listings)
- 30-day expiration with active subscription checking
- Legacy plan name mapping (`host_monthly` → Basic, `host_quarterly`/`host_yearly` → Pro)
- Plan listing endpoint for frontend display

### Notification Service (`:4006`)
- Subscribes to Redis `events` channel
- **Observer Pattern** — `NotificationEventBus` fans out to all registered channels
- **Channel abstraction** — `BaseChannel` → `ConsoleChannel`, `EmailChannel` (via MailerSend)
- Fetches user and listing details from Auth and Listing services for rich notification content
- Persists notification logs per channel with delivery status
- User notification history endpoint

### Analytics Service (`:4007`)
- Subscribes to Redis `events` channel
- Persists all events (type + JSON payload) to PostgreSQL
- Query endpoint for recent events (last 100)

---

## Design Patterns

| Pattern | Where | Purpose |
|---------|-------|---------|
| **State Machine** | Booking Service | Enforces valid booking lifecycle transitions |
| **Circuit Breaker** | Booking → Listing calls | Fault isolation; fast-fail on downstream outages |
| **Retry + Backoff** | Booking → Listing calls | Resilience against transient network failures |
| **Transactional Outbox** | Booking Service | At-least-once event delivery without external queues |
| **Strategy** | Listing Service (plans) | Pluggable subscription plan logic (Free/Basic/Pro) |
| **Adapter** | Payment Service | Swappable payment providers (Mock/Stripe) |
| **Observer** | Notification Service | Multi-channel fan-out for notifications |
| **Sliding Window Rate Limiter** | API Gateway | Per-user/IP request throttling |

---

## Folder Structure

```
spaceshare-microservices/
├── api-gateway/
├── auth-service/
├── listing-service/
├── search-service/
├── booking-service/
├── payment-service/
├── subscription-service/
├── notification-service/
├── analytics-service/
├── frontend/
├── tests/
├── docker-compose.yml
└── README.md
```

Each backend service follows a consistent layout:

```
service/
├── src/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── models/          # db.js, redis.js
│   ├── middleware/      # auth, correlation ID, rate limiting
│   ├── utils/           # circuit breaker, retry, date helpers
│   ├── strategies/      # (listing-service) plan strategies
│   ├── adapters/        # (payment-service) payment adapters
│   ├── channels/        # (notification-service) notification channels
│   └── app.js
├── server.js
├── schema.sql
├── Dockerfile
├── .env
└── package.json
```

---

## Setup & Running

### Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** (one database per service, or use a hosted provider like Neon)
- **Redis** ≥ 7
- **Docker** + **Docker Compose** (for containerised setup)

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone <repo-url>
cd spaceshare-microservices

# Configure environment variables
# Each service has a .env file — update DB_URL and any secrets as needed

# Build and start all services
docker compose up --build
```

All services start with Redis provided by the compose stack. Each service reads its `.env` file and the `docker-compose.yml` overrides inter-service URLs (e.g., `LISTING_SERVICE_URL=http://listing-service:4002`).

| Service | Port |
|---------|------|
| API Gateway | `4000` |
| Auth Service | `4001` |
| Listing Service | `4002` |
| Search Service | `4003` |
| Booking Service | `4004` |
| Subscription Service | `4005` |
| Notification Service | `4006` |
| Analytics Service | `4007` |
| Payment Service | `4008` |
| Frontend | `5173` |

### Option 2: Run Locally (No Docker)

#### 1. Start infrastructure
```bash
# Start PostgreSQL and Redis
sudo systemctl start postgresql redis
```

#### 2. Create databases and apply schemas
```bash
createdb auth_db       && psql auth_db       < auth-service/schema.sql
createdb listing_db    && psql listing_db    < listing-service/schema.sql
createdb search_db     && psql search_db     < search-service/schema.sql
createdb booking_db    && psql booking_db    < booking-service/schema.sql
createdb payment_db    && psql payment_db    < payment-service/schema.sql
createdb subscription_db && psql subscription_db < subscription-service/schema.sql
createdb notification_db && psql notification_db < notification-service/schema.sql
createdb analytics_db  && psql analytics_db  < analytics-service/schema.sql
```

#### 3. Configure environment
```bash
# Copy and edit .env in each service directory
cp auth-service/.env.example auth-service/.env
# Repeat for each service, updating DB_URL, JWT_SECRET, REDIS_URL, etc.
```

#### 4. Install dependencies and start services
Open separate terminals for each:
```bash
cd auth-service         && npm install && npm run dev
cd listing-service      && npm install && npm run dev
cd search-service       && npm install && npm run dev
cd booking-service      && npm install && npm run dev
cd payment-service      && npm install && npm run dev
cd subscription-service && npm install && npm run dev
cd notification-service && npm install && npm run dev
cd analytics-service    && npm install && npm run dev
cd api-gateway          && npm install && npm run dev
```

#### 5. Start frontend
```bash
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173**.

---

## Environment Variables

Each service uses a `.env` file with the following common variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | varies per service |
| `DB_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `JWT_SECRET` | Secret for signing JWTs | — |
| `LISTING_SERVICE_URL` | Listing Service base URL | `http://localhost:4002` |
| `BOOKING_SERVICE_URL` | Booking Service base URL | `http://localhost:4004` |
| `PAYMENT_SERVICE_URL` | Payment Service base URL | `http://localhost:4008` |
| `INTERNAL_SERVICE_TOKEN` | Shared token for internal service-to-service auth | — |
| `PAYMENT_PROVIDER` | Payment adapter: `mock` or `stripe` | `mock` |
| `CACHE_TTL_SECONDS` | Search cache TTL | `300` |
| `PAYMENT_UI_WINDOW_SECONDS` | Payment session timeout | `60` |
| `STALE_PENDING_RELEASE_SECONDS` | Auto-cleanup window for unpaid bookings | `120` |

---

## API Routes (via Gateway)

All requests go through `http://localhost:4000/api/`.

### Auth (public)
```bash
# Register
curl -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@test.com","password":"123456","role":"guest"}'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@test.com","password":"123456"}'
```

### Search (public)
```bash
curl 'http://localhost:4000/api/search?lat=37.7&lon=-122.4&radiusKm=10&min_price=0&max_price=300&capacity=2&sort_by=price_asc&page=1&limit=20'
```

### Listings (authenticated)
```bash
# Create a listing
curl -X POST http://localhost:4000/api/listings/spaces \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"title":"Downtown Office","lat":37.7749,"lon":-122.4194,"price_per_hour":25,"capacity":10,"timezone":"America/Los_Angeles"}'

# Get availability slots
curl 'http://localhost:4000/api/listings/spaces/1/slots?from=2026-04-28&to=2026-04-30' \
  -H 'Authorization: Bearer <token>'
```

### Bookings (authenticated)
```bash
# Create a booking
curl -X POST http://localhost:4000/api/bookings/book \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"space_id":1,"start_slot_utc":"2026-04-28T09:00:00Z","slot_count":2}'
```

### Payments (authenticated)
```bash
# Create a payment session
curl -X POST http://localhost:4000/api/payments/session \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"booking_id":1,"amount":50}'
```

### Subscriptions (authenticated)
```bash
# Subscribe to a plan
curl -X POST http://localhost:4000/api/subscriptions/subscribe \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"plan_type":"pro"}'
```

---

## Frontend Pages

| Page | Description |
|------|-------------|
| **Auth** | Register / Login |
| **Search** | Discover spaces with filters, geo-search, and sorting |
| **Add Space** | Hosts create new listings |
| **My Listings** | Hosts manage their spaces and availability |
| **My Bookings** | Guests view and manage their bookings |
| **Host Bookings** | Hosts view bookings for their spaces |
| **Subscriptions** | View plans, subscribe, and upgrade |
| **Payment Modal** | Complete payment during booking flow |

---

## Testing

Performance and availability tests live in `tests/`:

```bash
# Run availability / performance tests
node tests/availability-performance/test-availability.js
node tests/availability-performance/test-performance.js
node tests/availability-performance/test-nfr.js

# Booking service e2e tests
cd booking-service && npm test
```

---

## Health Check

```bash
# Aggregated health check (returns status of all services)
curl http://localhost:4000/health
```

Response:
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "downstream": {
    "auth": { "status": "healthy", "httpStatus": 200 },
    "listing": { "status": "healthy", "httpStatus": 200 },
    "booking": { "status": "healthy", "httpStatus": 200 },
    "payment": { "status": "healthy", "httpStatus": 200 },
    "...": "..."
  }
}
```
