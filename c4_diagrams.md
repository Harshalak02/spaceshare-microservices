# SpaceShare — C4 Model Diagrams (PlantUML)

Three levels of C4 diagrams — **System Context → Container → Component** — progressively zoom in to expose the four design patterns documented in Task 3.

---

## Level 1 — System Context Diagram

Shows SpaceShare as a single system and its relationships with external users and systems.

```plantuml
@startuml C4_Context_SpaceShare
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml

LAYOUT_WITH_LEGEND()

title System Context Diagram — SpaceShare

Person(guest, "Guest", "Searches for and books\nco-working spaces by the hour.")
Person(host, "Host / Space Owner", "Lists co-working spaces\nunder a subscription plan.")
Person(admin, "Platform Admin", "Manages listings, disputes,\nand platform analytics.")

System(spaceshare, "SpaceShare Platform", "Subscription-based co-working\nspace marketplace.\nNode.js microservices + React SPA.")

System_Ext(stripe, "Stripe", "Payment processing.\nHandles card data and\nPCI compliance.")
System_Ext(smtp, "SMTP Server\n(e.g. Gmail / SendGrid)", "Delivers booking confirmation\nemails to guests and hosts.")
System_Ext(osm, "OpenStreetMap / Leaflet", "Provides interactive map\ntiles and geo-coding.")

Rel(guest,   spaceshare, "Searches spaces,\ncreates bookings,\npays for slots", "HTTPS / REST")
Rel(host,    spaceshare, "Manages listings,\nviews bookings,\npurchases subscription", "HTTPS / REST")
Rel(admin,   spaceshare, "Moderates content,\nviews analytics", "HTTPS / REST")

Rel(spaceshare, stripe, "Creates PaymentIntents,\nreceives webhooks", "HTTPS / Stripe SDK")
Rel(spaceshare, smtp,   "Sends booking\nconfirmation emails", "SMTP / Nodemailer")
Rel(spaceshare, osm,    "Loads map tiles\nand geocodes addresses", "HTTPS")

@enduml
```

---

## Level 2 — Container Diagram

Zooms into SpaceShare to show each deployable container (service), the shared infrastructure, and how they communicate.

> **Design patterns are called out here** so the reader can see *where* each pattern lives before the component diagram shows *how*.

```plantuml
@startuml C4_Container_SpaceShare
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

LAYOUT_TOP_DOWN()
LAYOUT_WITH_LEGEND()

title Container Diagram — SpaceShare

Person(guest, "Guest")
Person(host,  "Host")

System_Boundary(spaceshare, "SpaceShare Platform") {

  Container(frontend, "React SPA", "React 18 + Vite\nLeaflet / OpenStreetMap",
            "Single-page application.\nAll requests routed via API Gateway.")

  Container(gateway, "API Gateway", "Node.js / Express",
            "Single entry point.\n[Pattern 4: Proxy/Gateway]\nJWT validation, path rewriting,\nrate limiting, correlation IDs.")

  Container(auth, "Auth Service", "Node.js / Express\nPostgreSQL",
            "User registration & login.\nIssues JWT tokens (bcrypt + jsonwebtoken).")

  Container(listing, "Listing Service", "Node.js / Express\nPostgreSQL + Redis",
            "CRUD for spaces.\nWeekly schedules & slot generation.\n[Pattern 1: Strategy]\nEnforces plan limits via PlanStrategy.")

  Container(search, "Search Service", "Node.js / Express\nPostgreSQL + Redis",
            "Geo-spatial bounding-box search.\n[Cache-Aside Tactic]\nRedis read-through cache, TTL 300 s.")

  Container(booking, "Booking Service", "Node.js / Express\nPostgreSQL (ACID) + Redis",
            "Booking lifecycle.\n[DB Constraint Tactic]\nUnique partial index prevents\ndouble-bookings (error 23505 → HTTP 409).\nStale-pending TTL cleanup.")

  Container(payment, "Payment Service", "Node.js / Express\nPostgreSQL + Stripe SDK",
            "Payment sessions & webhooks.\n[Pattern 2: Adapter]\nStripeAdapter / MockAdapter\nswapped via PAYMENT_PROVIDER env var.")

  Container(subscription, "Subscription Service", "Node.js / Express\nPostgreSQL",
            "Host plan management.\nFree / Basic / Pro tiers.\nExpiry computation & status queries.")

  Container(notification, "Notification Service", "Node.js / Express\nPostgreSQL + ioredis",
            "Redis Pub/Sub subscriber.\n[Pattern 3: Observer]\nNotificationEventBus fans out to\nEmailChannel + ConsoleChannel.")

  ContainerDb(redis, "Redis", "Redis 7",
              "Dual role:\n• Search / slot cache (TTL)\n• Event bus (Pub/Sub channel: 'events')")

  ContainerDb(postgres_auth,  "Auth DB",          "PostgreSQL", "users, credentials")
  ContainerDb(postgres_lst,   "Listing DB",       "PostgreSQL", "spaces, schedules, overrides")
  ContainerDb(postgres_bk,    "Booking DB",       "PostgreSQL", "bookings, booking_slots\n(unique partial index)")
  ContainerDb(postgres_pay,   "Payment DB",       "PostgreSQL", "payments, provider_reference")
  ContainerDb(postgres_sub,   "Subscription DB",  "PostgreSQL", "subscriptions, plan_type")
  ContainerDb(postgres_notif, "Notification DB",  "PostgreSQL", "notification_log")
}

System_Ext(stripe_ext, "Stripe", "External payment processor")
System_Ext(smtp_ext,   "SMTP Server", "Email delivery")

' ── Client → Frontend → Gateway ──────────────────────────────────────────────
Rel(guest,    frontend, "Uses browser", "HTTPS")
Rel(host,     frontend, "Uses browser", "HTTPS")
Rel(frontend, gateway,  "All API calls", "HTTPS / REST")

' ── Gateway → Services ────────────────────────────────────────────────────────
Rel(gateway, auth,         "/api/auth/**",         "HTTP")
Rel(gateway, listing,      "/api/listings/**",     "HTTP")
Rel(gateway, search,       "/api/search/**",       "HTTP")
Rel(gateway, booking,      "/api/bookings/**",     "HTTP")
Rel(gateway, payment,      "/api/payments/**",     "HTTP")
Rel(gateway, subscription, "/api/subscriptions/**","HTTP")
Rel(gateway, notification, "/api/notifications/**","HTTP")

' ── Service → DB ──────────────────────────────────────────────────────────────
Rel(auth,         postgres_auth,  "Reads / Writes", "TCP")
Rel(listing,      postgres_lst,   "Reads / Writes", "TCP")
Rel(booking,      postgres_bk,    "Reads / Writes (ACID)", "TCP")
Rel(payment,      postgres_pay,   "Reads / Writes", "TCP")
Rel(subscription, postgres_sub,   "Reads / Writes", "TCP")
Rel(notification, postgres_notif, "Writes log",     "TCP")

' ── Redis interactions ────────────────────────────────────────────────────────
Rel(search,       redis, "Cache-aside (GET/SET/EX)", "TCP")
Rel(listing,      redis, "Publish LISTING_* events\n+ slot cache", "TCP")
Rel(booking,      redis, "Publish BOOKING_* events", "TCP")
Rel(payment,      redis, "Publish PAYMENT_SUCCESS",  "TCP")
Rel(notification, redis, "Subscribe to 'events'",    "TCP")

' ── Internal service calls ────────────────────────────────────────────────────
Rel(listing,  subscription, "GET /plan/:userId\n(X-Internal-Token)", "HTTP")
Rel(listing,  booking,      "GET booked slots\nfor availability",    "HTTP")
Rel(payment,  booking,      "POST /internal/bookings/:id/confirm\n(X-Internal-Token)", "HTTP")
Rel(notification, auth,     "GET user details",    "HTTP")
Rel(notification, listing,  "GET space details",   "HTTP")

' ── External ─────────────────────────────────────────────────────────────────
Rel(payment, stripe_ext, "createPaymentIntent\nretrieveIntent", "HTTPS / Stripe SDK")
Rel(notification, smtp_ext, "sendMail()", "SMTP / Nodemailer")

@enduml
```

---

## Level 3 — Component Diagram (per pattern-heavy service)

Four focused component diagrams — one per design pattern — bridging directly to Task 3.

---

### 3a. Listing Service — Strategy Pattern (Task 3, Pattern 1)

```plantuml
@startuml C4_Component_ListingService_Strategy
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml

LAYOUT_WITH_LEGEND()

title Component Diagram — Listing Service (Strategy Pattern)

Container_Boundary(listing, "Listing Service") {

  Component(router,       "listingRoutes.js",    "Express Router",
            "Exposes POST /spaces, GET /spaces/:id, etc.")

  Component(ctrl,         "listingController.js","Express Controller",
            "Parses HTTP requests, delegates to listingService.")

  Component(svc,          "listingService.js",   "Domain Service",
            "Core business logic:\ncreatespace() calls fetchUserPlan()\nthen getPlan() to enforce limits\nbefore INSERT.")

  Component(factory,      "PlanFactory.js",      "Factory Function",
            "getPlan(planName):\nswitch → returns correct strategy instance.")

  Component(strategy_abs, "PlanStrategy.js",     "Abstract Strategy",
            "Interface:\n+ getListingLimit(): number\n+ getCommission(): number")

  Component(free,         "FreePlan.js",         "Concrete Strategy",
            "getListingLimit() → 2\ngetCommission() → 30%")

  Component(basic,        "BasicPlan.js",        "Concrete Strategy",
            "getListingLimit() → 5\ngetCommission() → 15%")

  Component(pro,          "ProPlan.js",          "Concrete Strategy",
            "getListingLimit() → 10\ngetCommission() → 5%")

  Component(db,           "db.js (PostgreSQL)",  "Database Client",
            "SELECT COUNT(*) of existing listings,\nINSERT new space.")
}

ContainerDb(postgres, "Listing DB", "PostgreSQL", "spaces table")
Container(sub_svc, "Subscription Service", "Node.js", "Returns host's active plan type")

Rel(router,       ctrl,         "calls")
Rel(ctrl,         svc,          "calls createSpace()")
Rel(svc,          sub_svc,      "GET /plan/:userId\n→ planName string", "HTTP + X-Internal-Token")
Rel(svc,          factory,      "getPlan(planName)")
Rel(factory,      strategy_abs, "returns instance of")
Rel(strategy_abs, free,         "implemented by")
Rel(strategy_abs, basic,        "implemented by")
Rel(strategy_abs, pro,          "implemented by")
Rel(svc,          strategy_abs, "plan.getListingLimit()\nplan.getCommission()")
Rel(svc,          db,           "COUNT existing + INSERT")
Rel(db,           postgres,     "SQL queries", "TCP")

@enduml
```

---

### 3b. Payment Service — Adapter Pattern (Task 3, Pattern 2)

```plantuml
@startuml C4_Component_PaymentService_Adapter
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml

LAYOUT_WITH_LEGEND()

title Component Diagram — Payment Service (Adapter Pattern)

Container_Boundary(payment, "Payment Service") {

  Component(router, "paymentRoutes.js",    "Express Router",
            "POST /sessions, POST /webhook,\nGET /sessions/:bookingId")

  Component(ctrl,   "paymentController.js","Express Controller",
            "Delegates to paymentService.")

  Component(svc,    "paymentService.js",   "Domain Service (Context)",
            "Constructor reads PAYMENT_PROVIDER env var\nand assigns this.adapter.\nAll payment ops delegate to this.adapter.")

  Component(abs,    "PaymentAdapter.js",   "Abstract Adapter",
            "Interface:\n+ createPaymentIntent(amount, currency, metadata)\n+ verifyPayment(payload)")

  Component(stripe_adp, "StripeAdapter.js","Concrete Adapter (Stripe)",
            "createPaymentIntent() → Stripe SDK\ncreates real PaymentIntent.\nverifyPayment() → Stripe retrieve.\nHandles 50 INR minimum.")

  Component(mock_adp,   "MockAdapter.js",  "Concrete Adapter (Mock)",
            "createPaymentIntent() → returns\ndeterministic mock intent IDs.\nverifyPayment() → always 'succeeded'.")

  Component(db,     "db.js (PostgreSQL)",  "Database Client",
            "Persists payment records,\nprovider_reference, status.")
}

System_Ext(stripe_ext, "Stripe API", "Real payment processing")
Container(booking_svc, "Booking Service", "Node.js", "Confirms booking on payment success")
ContainerDb(postgres, "Payment DB", "PostgreSQL", "payments table")

Rel(router,      ctrl,        "calls")
Rel(ctrl,        svc,         "createSession() / handleWebhook()")
Rel(svc,         abs,         "this.adapter (runtime binding)")
Rel(abs,         stripe_adp,  "implemented by (when PAYMENT_PROVIDER=stripe)")
Rel(abs,         mock_adp,    "implemented by (when PAYMENT_PROVIDER=mock)")
Rel(stripe_adp,  stripe_ext,  "stripe.paymentIntents.create()", "HTTPS")
Rel(svc,         db,          "INSERT / UPDATE payments")
Rel(svc,         booking_svc, "POST /internal/bookings/:id/confirm\non payment success", "HTTP + X-Internal-Token")
Rel(db,          postgres,    "SQL queries", "TCP")

@enduml
```

---

### 3c. Notification Service — Observer / Pub-Sub Pattern (Task 3, Pattern 3)

```plantuml
@startuml C4_Component_NotificationService_Observer
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml

LAYOUT_WITH_LEGEND()

title Component Diagram — Notification Service (Observer Pattern)

' ── External publishers ───────────────────────────────────────────────────────
Container(booking_svc, "Booking Service",  "Node.js", "Publisher:\nBOOKING_CREATED\nBOOKING_CONFIRMED\nBOOKING_CANCELLED")
Container(payment_svc, "Payment Service",  "Node.js", "Publisher:\nPAYMENT_SUCCESS")
Container(listing_svc, "Listing Service",  "Node.js", "Publisher:\nLISTING_CREATED\nLISTING_UPDATED\nLISTING_DELETED")

ContainerDb(redis, "Redis Pub/Sub", "Redis 7", "Channel: 'events'\nEvent format:\n{ type, timestamp, payload }")

Container_Boundary(notif, "Notification Service") {

  Component(server,    "server.js",               "Entry Point / Redis Subscriber",
            "Creates ioredis subscriber instance.\nsubscribes to 'events' channel.\nOn 'message': calls handleEvent(event)\nfor BOOKING_CONFIRMED + SUBSCRIPTION_EXPIRED.")

  Component(handler,   "notificationService.js",  "Event Handler",
            "handleEvent(event) dispatches to\nhandleBookingConfirmed() or handleSubscriptionExpired().\nFetches user & space details from\nAuth Service and Listing Service.\nBuilds { to, subject, body } context.\nCalls bus.publish(eventType, context).")

  Component(bus,       "NotificationEventBus.js", "Subject (Observable) — Singleton",
            "publish(eventType, context):\n1. _getActiveChannels(eventType)\n   → filters by isEnabled() + subscribedEvents\n2. Fan-out: Promise.all(ch.notify()) for\n   all active, subscribed channels.\nsubscribe(ch) / unsubscribe(ch): dynamic\nregistration of observer channels.")

  Component(base_ch,   "BaseChannel.js",          "Abstract Observer",
            "Interface:\n+ get subscribedEvents(): string[]\n+ isEnabled(): boolean\n+ notify(eventType, context): Promise\n+ send(to, subject, body): Promise")

  Component(email_ch,  "EmailChannel.js",         "Concrete Observer",
            "subscribedEvents → ['*']\nisEnabled() → NOTIFICATION_CHANNELS includes 'email'\nsend() → Nodemailer SMTP transporter")

  Component(console_ch,"ConsoleChannel.js",       "Concrete Observer",
            "subscribedEvents → ['*']\nisEnabled() → NOTIFICATION_CHANNELS includes 'console'\nsend() → console.log with formatted output")

  Component(db,        "db.js (PostgreSQL)",      "Database Client",
            "Writes notification log records.")
}

System_Ext(smtp_ext, "SMTP Server", "Email delivery (Gmail / SendGrid)")
ContainerDb(postgres, "Notification DB", "PostgreSQL", "notification_log table")
Container(auth_svc,    "Auth Service",    "Node.js", "GET /users/:id for email address")
Container(listing_svc2,"Listing Service", "Node.js", "GET /spaces/:id for space details")

' ── Event flow ────────────────────────────────────────────────────────────────
Rel(booking_svc, redis, "PUBLISH 'events'", "TCP")
Rel(payment_svc, redis, "PUBLISH 'events'", "TCP")
Rel(listing_svc, redis, "PUBLISH 'events'", "TCP")

Rel(server,  redis,   "SUBSCRIBE 'events'", "TCP / ioredis")
Rel(server,  handler, "handleEvent(event)")

Rel(handler, auth_svc,     "GET user email", "HTTP")
Rel(handler, listing_svc2, "GET space info", "HTTP")
Rel(handler, bus,          "bus.publish(eventType, context)")

Rel(bus, base_ch,    "calls ch.notify()")
Rel(base_ch, email_ch,   "implemented by")
Rel(base_ch, console_ch, "implemented by")

Rel(email_ch,   smtp_ext, "sendMail()", "SMTP / Nodemailer")
Rel(handler,    db,       "INSERT notification log")
Rel(db,         postgres, "SQL queries", "TCP")

@enduml
```

---

### 3d. API Gateway — Proxy / Gateway Pattern (Task 3, Pattern 4)

```plantuml
@startuml C4_Component_APIGateway_Proxy
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml

LAYOUT_WITH_LEGEND()

title Component Diagram — API Gateway (Proxy / Gateway Pattern)

Container_Boundary(gateway, "API Gateway") {

  Component(cors_mw,    "CORS Middleware",          "Express cors()",
            "Allows cross-origin requests from React SPA.")

  Component(corr_mw,    "Correlation ID Middleware","Custom Middleware",
            "Generates or forwards X-Correlation-ID\nfor end-to-end distributed tracing.")

  Component(rate_mw,    "Rate Limiter",             "Custom RateLimiter",
            "Global: 120 req/min per user.\nPrevents abuse before routing.")

  Component(auth_mw,    "authMiddleware.js",        "JWT Validator",
            "Verifies JWT signature and expiry.\nAttaches decoded user (id, role) to req.user.\nApplied to all protected routes.")

  Component(routes,     "gatewayRoutes.js",         "Route Map",
            "Public: /auth/**, /search/**\nProtected (authMiddleware applied):\n/listings/**, /bookings/**,\n/payments/**, /subscriptions/**,\n/notifications/**")

  Component(proxy_svc,  "proxyService.js",          "Proxy / Forwarder",
            "forwardRequest(serviceUrl, req, overrides):\n• Preserves HTTP method\n• Forwards query params\n• Forwards Authorization header\n• Forwards X-Correlation-ID\n• Uses Axios for outbound call\n• Returns downstream status + body.")

  Component(health,     "Health Check Handler",     "Inline Route",
            "GET /health:\nQueries all 8 downstream /health endpoints\nconcurrently (3 s timeout each).\nReturns 200 (healthy) or 207 (degraded).")
}

Container(frontend,  "React SPA",          "Vite", "All client requests")
Container(auth,      "Auth Service",       "Node.js", ":4001")
Container(listing,   "Listing Service",    "Node.js", ":4002")
Container(search,    "Search Service",     "Node.js", ":4003")
Container(booking,   "Booking Service",    "Node.js", ":4004")
Container(payment,   "Payment Service",    "Node.js", ":4005")
Container(notif,     "Notification Svc",   "Node.js", ":4006")
Container(sub,       "Subscription Svc",   "Node.js", ":4007")
Container(analytics, "Analytics Svc",      "Node.js", ":4008")

Rel(frontend, cors_mw,   "HTTP request")
Rel(cors_mw,  corr_mw,   "next()")
Rel(corr_mw,  rate_mw,   "next()")
Rel(rate_mw,  routes,    "next() → route match")
Rel(routes,   auth_mw,   "applied to protected routes")
Rel(auth_mw,  proxy_svc, "req.user set → forward")
Rel(routes,   proxy_svc, "public routes → forward directly")

Rel(proxy_svc, auth,      "Axios → AUTH_SERVICE_URL",      "HTTP")
Rel(proxy_svc, listing,   "Axios → LISTING_SERVICE_URL",   "HTTP")
Rel(proxy_svc, search,    "Axios → SEARCH_SERVICE_URL",    "HTTP")
Rel(proxy_svc, booking,   "Axios → BOOKING_SERVICE_URL",   "HTTP")
Rel(proxy_svc, payment,   "Axios → PAYMENT_SERVICE_URL",   "HTTP")
Rel(proxy_svc, notif,     "Axios → NOTIFICATION_SERVICE_URL","HTTP")
Rel(proxy_svc, sub,       "Axios → SUBSCRIPTION_SERVICE_URL","HTTP")
Rel(health,    analytics, "fetch /health (3 s timeout)",   "HTTP")

@enduml
```

---

## How the C4 Diagrams Flow into Task 3 Design Patterns

| C4 Level | What it shows | Design Pattern Exposed |
|---|---|---|
| **Context** | SpaceShare as a black box with Guest, Host, Stripe, SMTP | Sets the stage — explains *why* patterns are needed |
| **Container** | All 9 containers; Redis dual role; inter-service calls | Identifies *which container* each pattern lives in |
| **Component — Listing** | PlanStrategy ← FreePlan/BasicPlan/ProPlan, PlanFactory | **Pattern 1: Strategy** |
| **Component — Payment** | PaymentAdapter ← StripeAdapter/MockAdapter, env-var binding | **Pattern 2: Adapter** |
| **Component — Notification** | NotificationEventBus (Subject) ← BaseChannel ← Email/Console | **Pattern 3: Observer/Pub-Sub** |
| **Component — API Gateway** | authMiddleware, rateLimiter, proxyService.forwardRequest | **Pattern 4: Proxy/Gateway** |

> **Rendering tip**: Paste each `@startuml … @enduml` block into [plantuml.com/plantuml](https://www.plantuml.com/plantuml/uml/) or use the PlantUML VS Code extension to render the diagrams instantly.
