# Mirai Skin Phase 2 — Feature Design

## Overview

Four features to make the abandoned cart agent production-ready: Admin Dashboard, Conversion Tracking, Business Hours Guard, and Multi-Channel Fallback.

---

## Feature 1: Admin Dashboard

**Tech:** Server-rendered HTML with EJS templates, Tailwind CSS via CDN, password-protected via express-session.

**Auth:** Simple password gate. `DASHBOARD_PASSWORD` env var. Middleware checks session cookie, shows password form if not authenticated.

**Pages:**

- **`/dashboard`** — Overview: total calls, recovery rate %, revenue recovered, calls today. Chart of daily calls over last 30 days.
- **`/dashboard/calls`** — Call log table: customer name, phone, cart total, outcome, duration, date. Filterable by outcome + date range.
- **`/dashboard/calls/:id`** — Single call detail: full transcript, cart items, discount used, timestamps.

**Data source:** Existing SQLite `calls` table + new `revenue_recovered` column.

---

## Feature 2: Conversion Tracking

**How it works:**
1. Register a Shopify `orders/create` webhook
2. When order arrives, check if customer email/phone matches a recent call record (last 7 days)
3. If match → update call record with `revenue_recovered` amount and `converted_at` timestamp

**New endpoint:** `POST /api/webhook/shopify-order`
- Validates Shopify HMAC signature for security
- Extracts customer email + phone from the order payload
- Looks up matching call records
- Updates matching call with order total

**New DB columns:**
- `revenue_recovered` (REAL)
- `converted_at` (DATETIME)

---

## Feature 3: Business Hours Guard

**Rules:** Only call between 9 AM – 8 PM in the customer's local timezone.

**Implementation:**
- Before triggering Vapi call, check `isWithinCallingHours(state, country)`
- Timezone detection: map US state codes to timezones, default to EST for unknown
- If outside hours → store call with status `scheduled` and `scheduled_for` timestamp
- Lightweight scheduler (`setInterval` every 5 minutes) checks for scheduled calls that are now within hours

**New DB columns:**
- `scheduled_for` (DATETIME)
- `customer_timezone` (TEXT)

**Timezone source:** Customer state/country from the Klaviyo webhook payload.

---

## Feature 4: Multi-Channel Fallback

**Trigger:** When Vapi call outcome is `no_answer` or `voicemail`.

**Actions (in order):**
1. Send SMS via Twilio: "Hi [Name]! We tried reaching you about your Mirai Skin order. Your cart is still saved — complete your purchase here: [checkout_url]"
2. Trigger Klaviyo event `Recovery Call Failed` on the customer's profile with cart data, which kicks off a Klaviyo email flow

**Implementation:**
- Modify `src/routes/vapiWebhook.js` to trigger fallback after processing end-of-call-report
- New Klaviyo service function: `triggerKlaviyoEvent(email, eventName, properties)` — posts to Klaviyo Events API
- Klaviyo flow (manual setup): triggered by "Recovery Call Failed" event → sends abandoned cart email

---

## New Dependencies

- `ejs` — template engine for dashboard
- `express-session` — session management for dashboard auth

## New Environment Variables

- `DASHBOARD_PASSWORD` — password for admin dashboard access
- `SESSION_SECRET` — secret for express-session
- `SHOPIFY_WEBHOOK_SECRET` — for validating Shopify order webhooks

## Database Migrations

New columns on `calls` table:
- `revenue_recovered` REAL
- `converted_at` DATETIME
- `scheduled_for` DATETIME
- `customer_timezone` TEXT
