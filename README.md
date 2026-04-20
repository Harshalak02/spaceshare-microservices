# SpaceShare Microservices (Node.js + React)

This repository contains a complete beginner-friendly microservices system for a co-working space marketplace.

## Tech Stack
- Backend services: Node.js + Express
- Databases: PostgreSQL (`pg`)
- Cache/events: Redis (`ioredis`)
- Auth: JWT + bcrypt
- Frontend: React + Vite

## Implemented Services
- API Gateway (`4000`)
- Auth Service (`4001`)
- Listing Service (`4002`)
- Search Service (`4003`)
- Booking Service (`4004`)
- Subscription Service (`4005`)
- Notification Service (`4006`)
- Analytics Service (`4007`)
- Frontend (`5173`)

## Folder Structure

```
.
├── api-gateway/
├── auth-service/
├── listing-service/
├── search-service/
├── booking-service/
├── subscription-service/
├── notification-service/
├── analytics-service/
└── frontend/
```

Each backend service follows:

```
service/
├── src/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── models/
│   └── app.js
├── server.js
├── package.json
├── .env.example
└── schema.sql
```

## Key Behaviors

### API Gateway
Routes client requests to internal services:
- `/api/auth/*`
- `/api/listings/*`
- `/api/search/*`
- `/api/bookings/*`
- `/api/subscriptions/*`

### Auth Service
- Register/login endpoints
- Password hashing via bcrypt
- JWT generation and token validation

### Listing Service
- Space CRUD
- Amenities mapping table

### Search Service
- Bounding box search on `lat/lon`
- Filters: price range + minimum capacity
- Redis cache storing only `space_ids`
- TTL configurable (`CACHE_TTL_SECONDS`, default 300s)

### Booking Service
- Create bookings
- Prevent overlapping (double) booking
- Checks Listing Service for space existence
- Emits `BOOKING_CONFIRMED` to Redis pub/sub (`events` channel)

### Subscription Service
- Mock plan subscription
- 30-day expiration simulation

### Notification Service
- Subscribes to `events`
- Logs mock notification for `BOOKING_CONFIRMED` and `SUBSCRIPTION_EXPIRED`

### Analytics Service
- Subscribes to `events`
- Persists events in PostgreSQL table

## SQL Setup
Every service includes `schema.sql`. Create one PostgreSQL DB per service and run matching schema file.

Example:
```bash
createdb auth_db
psql auth_db < auth-service/schema.sql
```

Do similarly for:
- `listing_db`
- `search_db`
- `booking_db`
- `subscription_db`
- `analytics_db`

> Notification and API Gateway are stateless (their schema file contains comments only).

## Environment Variables
Copy each `.env.example` to `.env` and adjust values.

Example:
```bash
cp auth-service/.env.example auth-service/.env
```

Redis default: `redis://localhost:6379`

## Run Locally (No Docker)

### 1) Start infrastructure
- Start PostgreSQL
- Start Redis

### 2) Install dependencies and run each backend service
Open separate terminals:

```bash
cd auth-service && npm install && npm run dev
cd listing-service && npm install && npm run dev
cd search-service && npm install && npm run dev
cd booking-service && npm install && npm run dev
cd subscription-service && npm install && npm run dev
cd notification-service && npm install && npm run dev
cd analytics-service && npm install && npm run dev
cd api-gateway && npm install && npm run dev
```

### 3) Run frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Frontend Flow
1. Register a user
2. Login
3. Search spaces (via API Gateway only)
4. Click Book to create booking request (via API Gateway)

## Example API Calls via Gateway
```bash
# Register
curl -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@test.com","password":"123456"}'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@test.com","password":"123456"}'

# Search
curl 'http://localhost:4000/api/search?lat=37.7&lon=-122.4&radius=0.1&min_price=0&max_price=300&capacity=2'
```

## Notes
- Services are intentionally simple and beginner-friendly.
- All business logic uses async/await.
- Comments are included in core logic files to explain important decisions.
