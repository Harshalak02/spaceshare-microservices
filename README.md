# SpaceShare Microservices System — Implementation README (Node.js)

## 1. Overview

This project implements a **microservices-based backend** for a co-working space booking platform.

Each service:

* Runs independently
* Has its own database
* Communicates via REST APIs
* Uses Redis for caching and messaging

---

## 2. Architecture

### Services

* **API Gateway**
* **Auth Service**
* **Listing Service**
* **Search Service**
* **Booking Service**
* **Subscription Service**
* **Notification Service**
* **Analytics Service**

---

## 3. Tech Stack

* Node.js (Express.js)
* PostgreSQL (per service DB)
* Redis (caching + pub/sub)

* JWT (authentication)

---

## 4. Folder Structure

```
project-root/
│
├── api-gateway/
├── auth-service/
├── listing-service/
├── search-service/
├── booking-service/
├── subscription-service/
├── notification-service/
├── analytics-service/

└── README.md
```

---

## 5. API Gateway

### Responsibilities:

* Route requests
* Handle authentication middleware
* Forward requests to services

### Routes:

```
/api/auth → auth-service
/api/listings → listing-service
/api/search → search-service
/api/bookings → booking-service
/api/subscriptions → subscription-service
```

---

## 6. Auth Service

### Features:

* Register/Login
* JWT generation & validation

### Endpoints:

```
POST /register
POST /login
GET /validate-token
```

### DB Schema:

```
users:
- id
- email
- password_hash
- role (host/guest/admin)
```

---

## 7. Listing Service

### Features:

* Create/edit/delete spaces
* Manage amenities

### Endpoints:

```
POST /spaces
GET /spaces/:id
PUT /spaces/:id
DELETE /spaces/:id
```

### DB Schema:

```
spaces:
- id
- title
- lat
- lon
- price_per_hour
- capacity
- owner_id

amenities:
- id
- name

space_amenities:
- space_id
- amenity_id
```

---

## 8. Search Service (IMPORTANT)

### Features:

* Geo-based search
* Filtering
* Redis caching

---

### Flow:

1. Check Redis cache
2. If hit → return results
3. If miss → query DB → cache result

---

### Cache Key Format:

```
search:lat:<lat>:lon:<lon>:radius:<r>:price:<range>:capacity:<cap>
```

---

### Cache Value:

```
[space_id1, space_id2, ...]
```

---

### DB Query Logic:

```
WHERE lat BETWEEN min_lat AND max_lat
AND lon BETWEEN min_lon AND max_lon
AND price_per_hour BETWEEN X AND Y
AND capacity >= N
```

---

### TTL:

* Search cache: 5–10 min

---

## 9. Booking Service

### Features:

* Book slots
* Prevent double booking

---

### Endpoints:

```
POST /book
GET /bookings/:user_id
```

---

### Flow:

1. Call Listing Service → check availability
2. Validate slot
3. Insert booking
4. Emit event: BOOKING_CONFIRMED

---

### DB Schema:

```
bookings:
- id
- space_id
- user_id
- start_time
- end_time
```

---

## 10. Subscription Service

### Features:

* Manage host subscriptions
* Stripe integration (mock initially)

---

### Endpoints:

```
POST /subscribe
GET /subscription/:user_id
```

---

### DB Schema:

```
subscriptions:
- id
- user_id
- plan_type
- expiry_date
```

---

## 11. Notification Service

### Features:

* Listen to events
* Send emails (mock)

---

### Events:

```
BOOKING_CONFIRMED
SUBSCRIPTION_EXPIRED
```

---

## 12. Analytics Service

### Features:

* Log events
* Track usage

---

### Events:

```
SEARCH_PERFORMED
BOOKING_CREATED
```

---

## 13. Redis Usage

### 1. Caching

* Search results
* Space metadata (optional)

---

### 2. Pub/Sub (events)

```
booking-service → publish → BOOKING_CONFIRMED
notification-service → subscribe
analytics-service → subscribe
```

---

## 14. Service Communication

### Sync (REST)

* Booking → Listing (availability)
* Booking → Subscription (validation)

---

### Async (Redis Pub/Sub)

* Booking → Notification
* Booking → Analytics

---

## 15. Environment Variables

Each service should have:

```
PORT=
DB_URL=
REDIS_URL=
JWT_SECRET=
SERVICE_URLS=
```

---

## 16. Running the System

### Step 1:

Start PostgreSQL and Redis

---

### Step 2:

Run each service:

```
cd auth-service
npm install
npm run dev
```

Repeat for all services

---

### Step 3:

Start API Gateway

---


## 18. Key Design Decisions

* Each service owns its data
* Redis used as centralized cache
* Hybrid caching strategy
* API Gateway for routing
* Event-driven async processing

---

## 19. Future Improvements

* Add message broker (Kafka/RabbitMQ)
* Use PostGIS for geo queries
* Add rate limiting
* Add distributed tracing

---

## 20. Final Notes for Codex

* Use Express.js for all services
* Use Sequelize or Prisma for DB
* Use ioredis for Redis
* Follow REST conventions
* Keep services independent

---

## 21. Summary

This system is:

* Scalable
* Modular
* Cache-optimized
* Event-driven

Each service is independently deployable and communicates through well-defined APIs and shared Redis infrastructure.

