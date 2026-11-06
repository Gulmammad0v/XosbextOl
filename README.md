# Xoşbəxt Ol — Wedding Hall Booking

A layered monolith built with Java 21, Spring Boot and Gradle (exact versions are in `build.gradle` and the Gradle wrapper).
Root package: `com.app.xosbextol`.

## Getting started (Windows / PowerShell)

```powershell
Copy-Item .env.example .env
docker compose up -d
.\gradlew.bat bootRun --args='--spring.profiles.active=dev'
```

API: http://localhost:8090/api  
Swagger: http://localhost:8090/swagger-ui.html  
RabbitMQ: http://localhost:15672 — `toyapp` / the password from `.env`  
MinIO: http://localhost:9001 — the username/password from `.env`  
Mailpit (local mailbox): http://localhost:8025

In the `dev` profile the OTP is sent by email through SMTP; open the verification email in Mailpit.
The payment gateway is a `stub`: it performs no real money transactions and must not be enabled in production.
Gradle does not read the `.env` file itself: the dev defaults match the example Docker passwords.
If you change the passwords, pass the matching environment variables to the backend as well.

Create the `toyapp-media` bucket in the MinIO console. To serve images, grant read-only access
through the bucket/CDN; keep write access in the backend credentials only.

### Logging

The backend uses Log4j2. Logs are written to stdout and to `logs/application.log`;
the file rotates daily or when it reaches 20 MB, and archives are kept for 30 days.
The path and levels can be changed with the `LOG_PATH`, `LOG_LEVEL_ROOT`, `LOG_LEVEL_APP` and `LOG_LEVEL_SQL` variables.

## First admin and partner

First register with an email OTP and create a profile and password. A new account is always a `CUSTOMER`.
The operator assigns the first admin in the database (replace the email with your own):

```powershell
docker compose exec postgres psql -U toyapp -d toyapp -c "UPDATE users SET role_id=(SELECT id FROM user_roles WHERE code='ADMIN') WHERE email='admin@example.com';"
```

Then sign in again. An admin can grant a partner the `VENUE_OWNER` role with `PATCH /api/admin/users/{id}`.
Public registration does not accept the admin or partner roles.

## Package structure

| Package | Responsibility |
|---|---|
| controller | REST controllers |
| service / service.impl | Business interfaces and their implementations |
| service.rabbit | RabbitMQ publishers and consumers |
| model / model.dto / model.event | JPA entities, API models, domain events |
| repository | Spring Data repositories |
| config | Security, OpenAPI, RabbitMQ and storage configuration |
| client | Adapters for external systems such as email, payment and push |
| scheduler / listener | Periodic jobs and event listeners |
| handler | Unified error handling and custom exceptions |
| mapper / security / util | Mappers, the current user and helper classes |

Controllers do not touch repositories or external clients directly. Entities are not returned as HTTP responses.
ArchUnit checks the layer boundaries automatically.

## Core API flow

1. `POST /api/auth/register/otp/send` — `{"email":"customer@example.com"}`
2. `POST /api/auth/register/otp/verify` — `{"email":"customer@example.com","code":"123456"}`
3. Use the returned one-time `token` with `POST /api/auth/register/complete`:
   `{"token":"...","firstName":"Aysel","lastName":"Məmmədova","birthDate":"1995-05-10","password":"...","confirmPassword":"...","deviceInfo":"Android"}`
4. For later sign-ins, use `POST /api/auth/login` — `{"email":"customer@example.com","password":"...","deviceInfo":"Android"}`.
5. Send the returned access token in the `Authorization: Bearer ...` header. An access token lives for at most 15 minutes.
6. `GET /api/venues?city=Bakı&guests=200&minPrice=30&maxPrice=100&date=2026-12-20`
7. `GET /api/halls/{id}/availability?month=2026-12`
8. `POST /api/bookings`, with a required `Idempotency-Key` header:
   `{"hallId":1,"eventDate":"2026-12-20","eventType":"WEDDING","guestCount":200,"extraServiceIds":[]}`
9. `POST /api/payments/initiate`, with its own `Idempotency-Key`: `{"bookingId":1}`.
   Only the deposit is paid on the platform; the remaining amount is paid at the restaurant.
10. Open the checkout URL from the payment response. The customer's redirect does not confirm the booking.
11. The gateway confirms the payment through a webhook or server-side reconciliation.

The email address is normalized (whitespace is trimmed and it is lowercased). An account is created only after a
valid OTP and once the first name, last name, date of birth and password are completed. Editing the profile does
not change the sign-in email. OTP codes are kept in Redis for a short time; attempt and IP limits are enforced.

When a user forgets their password, the `/api/auth/password/forgot/otp/send` and
`/api/auth/password/forgot/otp/verify` flow issues a one-time reset token;
`/api/auth/password/reset` sets the new password and revokes all old sessions.

Active sign-in sessions: `GET /api/users/me/sessions`; to revoke a session, use
`DELETE /api/users/me/sessions/{id}`. Revoking a session stops its refresh token.

Other endpoints:
- All lists accept `page` (starting from 0) and `size` (1–100).
- Dates use the Asia/Baku calendar for halls; timestamps are stored in UTC.
- Partner: `/api/partner/venues`, `/api/partner/venues/{id}/bookings`, report `GET /api/partner/venues/{id}/report`.
- Partner media upload: `POST /api/partner/venues/{id}/media/upload` (multipart `file`, optional `hallId`).
  JPEG/PNG, up to 20 MB / 40 MP; sizes 2400/1200/400. Register by URL: `POST /api/partner/venues/{id}/media`.
- Admin promo management: `GET/POST /api/admin/promos`, `PUT /api/admin/promos/{id}`.

All endpoints and DTOs are documented in Swagger.

## Booking and payment invariants

- A hall row lock serializes all booking and manual block writes.
- Each hall is booked for the whole day; a second booking or a manual block on the same date is rejected.
- COMPLETED dates also count as taken.
- The hold lasts 15 minutes. The scheduler releases the date only after atomically cancelling or checking the
  temporary payment at the gateway. If the gateway response is uncertain, the hold is kept and retried.
- The payment price is calculated on the server; hall, extras and discount are stored as a snapshot.
- Before the gateway call, the INITIATED payment is committed in a separate transaction.
  If the response is lost, the session is restored using the same provider idempotency key.
- Promo usage is locked inside the transaction; when a pending or cancelled hold is released, the limit is returned.
- The same `Idempotency-Key` with a different payload returns 409.
- The webhook verifies amount, currency and transaction; duplicate and concurrent webhooks do not credit twice.
- If SUCCESS arrives after cancellation or expiry, the date is not taken again; a refund is created.
- A customer can cancel at least 7 days before the event. The deposit is not refunded; any payment above the
  deposit is refunded. If the venue rejects the booking, the entire payment is refunded.
  This rule lives in `JpaBookingService.cancel` and should be changed to match the real contract.
- Refund retries use the same provider idempotency key.
- The outbox guarantees that a notification is written together with the booking transaction; it becomes QUEUED
  after the broker's publisher confirm, and the consumer manages the SENT/DEAD states.
  External delivery is at-least-once; if the email provider accepts a message but the response is lost, a duplicate is possible.

## Payment adapter and webhook contract

Because no provider has been chosen yet, the production `HttpPaymentGateway` connects to a configurable
**adapter service**. This contract is not a direct Epoint/Payriff API; for the chosen provider, a `PaymentGateway`
implementation and a signature adapter must be written against its official API and webhook format.

HTTP adapter:
- `POST /sessions`: Request(paymentId, bookingId, amount, currency, idempotencyKey);
  response `{"transactionId":"...","checkoutUrl":"https://..."}`.
- `GET /transactions/{id}` and `POST /transactions/{id}/cancel`:
  `{"transactionId":"...","status":"SUCCESS|PENDING|FAILED|CANCELLED|UNKNOWN","amount":1800,"currency":"AZN"}`.
  Cancel must return CANCELLED only when it can atomically stop settlement.
- `POST /transactions/{id}/refund`: `{"amount":1800}`, with an `Idempotency-Key` header; for a fully processed refund,
  `{"transactionId":"refund-reference","checkoutUrl":null}`.
- The provider must durably store the idempotency key of session and refund calls.
- Authorization: `Bearer PAYMENT_API_KEY`. There is a timeout, limited retry and a circuit breaker.

Webhook: `POST /api/payments/webhook`, JSON:

```json
{"provider":"stub","transactionId":"stub-...","status":"SUCCESS","amount":1800.00,"currency":"AZN"}
```

`X-Timestamp`: Unix seconds, at most 5 minutes of difference. `X-Signature`:
hex `HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, timestamp + "." + exact_raw_body)`.
On each retry the gateway sends the same transaction ID with a new timestamp and signature.
The `stub` URL is not a payment page; for local testing, send the webhook following this contract.
A "paid" claim coming from the mobile app is never trusted.

Production requires `PAYMENT_BASE_URL`, `PAYMENT_API_KEY`, `PAYMENT_PROVIDER` and
`PAYMENT_WEBHOOK_SECRET`.

## Email, push, social sign-in and storage

- **Push:** sent through the Firebase Admin SDK directly over FCM HTTP v1. Set `FIREBASE_ENABLED=true` and
  provide the path of the service-account JSON file, stored outside the repository, with `FIREBASE_CREDENTIALS`.
  For the Android/iOS Firebase files and APNs setup, see `mobile/FIREBASE_SETUP.md`.
- **Email:** `SMTP_HOST/PORT/USER/PASSWORD/AUTH/TLS` and `EMAIL_FROM`.
- **Language:** notifications are generated in the profile's `az/ru/en` language; translations are in `messages_*.properties`.
- **Google sign-in:** `GOOGLE_CLIENT_IDS` (iOS and Android client IDs, separated by commas). The signature, issuer,
  audience, expiry and a one-time nonce are verified. The mobile app signs up and signs in through
  `/api/auth/social/challenge` → `/api/auth/social/login`. A verified email creates a new `CUSTOMER` account;
  if an account with that email already exists, the social identity is linked to it. To link an additional social
  account from inside the profile, use `/api/users/me/social/challenge` → `/api/users/me/social`.
- **Storage (S3-compatible):** `S3_ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY/BUCKET` and `CDN_URL`.
  On AWS, an empty access key uses the default credential chain / IAM role.
  For Cloudflare R2, use `S3_REGION=auto` and `S3_INITIALIZE_BUCKET=false`; create the bucket beforehand
  in the R2 dashboard.
- When an uploaded restaurant image is deleted, its full/medium/thumb objects are also removed from storage.
  If the storage deletion fails, the database operation is rolled back.

## Restaurant owner registration and admin panel

A restaurant owner chooses the `VENUE_OWNER` account in mobile registration and creates each branch separately in six steps.
Draft data is saved step by step. Approval requires: at least 1 hall, 5 unique photos, 1 menu package,
a map address, a tax ID (VÖEN), a 7-character FIN, photos of the company/identity documents, and acceptance of the current contract.

An active branch shows no separate registration button. In management, the owner can edit only the basic information,
halls/photos and menu/services sections; every such change sends the branch back for admin approval.
The admin panel shows changed fields with their previous and new values. After the admin's decision the owner is notified
(with a reason if rejected). The company, document and contract section is read-only for an active branch.

The admin web panel is available while the backend is running at `http://localhost:8090/admin/index.html` and works only
with the JWT of an `ADMIN` role. The panel supports the approval list, rejection reason, decisions on critical changes,
editing on behalf of an owner, hiding and freezing.

Map selection opens the `/map-picker.html` page served by the backend using `expo-web-browser` and returns the chosen
coordinates to the app through a deep link. This flow requires no extra map module in Expo Go or the native app.

## Testing and build

```powershell
.\gradlew.bat test
.\gradlew.bat integrationTest
.\gradlew.bat bootJar
```

Integration tests start their own PostgreSQL/Redis/RabbitMQ/Mailpit containers in Docker; they do not connect to an
existing database. They cover: concurrency, hall/date blocking, idempotency, late webhook/refund, JWT role/blocking,
refresh rotation, OTP limits/attempts, review eligibility, a lost gateway response, real RabbitMQ outbox delivery
and email OTP over real SMTP. CI runs these tests and `bootJar`.

`scripts/loadtest.js` is a read-load scenario for k6:
`k6 run -e BASE_URL=http://localhost:8090 -e HALL_ID=1 scripts/loadtest.js`.
This is a simple read test; a full load test must be run separately.

The database schema is created and updated by Hibernate `ddl-auto: update`. Status, amenity and menu catalogs are
completed idempotently when the application starts; the city catalog is kept in the application code.

The mobile app is in the `mobile/` folder.

## Limitations

- The payment gateway is a `stub`; real provider accounts and sandbox integration are not connected.
- Automatic payout/bank transfer is not active; the remaining amount is paid only at the restaurant.
- A complaint workflow, monitoring dashboards and seasonal load testing are separate phases.
- The `TEST-2026-01` offer text is for testing only. The real cancellation, tax and data-processing terms
  must be prepared by a lawyer before going live.