# Free WhatsApp Messaging & Growth Engine: Complete Setup Guide

A comprehensive, framework-agnostic guide to setting up and operating an automated WhatsApp messaging engine for free using Meta Business Suite, including complete architecture workflows, free tier allowances, and an anti-ban protection playbook.

---

## Table of Contents

1. [Meta Business Suite: Adding & Verifying a Number for Free](#1-meta-business-suite-adding--verifying-a-number-for-free)
2. [Messaging Architecture & Workflow](#2-messaging-architecture--workflow)
3. [Free Tier Allowances & Keeping Costs at $0](#3-free-tier-allowances--keeping-costs-at-0)
4. [Anti-Ban Playbook: Protecting Your Number](#4-anti-ban-playbook-protecting-your-number)
5. [Core Data Models & Webhook Specification](#5-core-data-models--webhook-specification)

---

## 1. Meta Business Suite: Adding & Verifying a Number for Free

Meta provides direct access to the official **WhatsApp Cloud API** without monthly subscription fees or setup costs.

### Step 1: Prepare the Phone Number
* **Crucial Rule:** The phone number you plan to use **cannot** be actively registered on the standard WhatsApp or WhatsApp Business mobile apps.
* If the number is currently in use on a phone:
  1. Open WhatsApp on the device.
  2. Go to **Settings $\rightarrow$ Account $\rightarrow$ Delete Account**.
  3. This unlinks the number from consumer WhatsApp servers so Meta Cloud API can claim it.
* The number must be capable of receiving an SMS or voice call for verification.

---

### Step 2: Create a Meta Developer App
1. Go to **[developers.facebook.com](https://developers.facebook.com/)** and log in with your Facebook account.
2. Click **Create App**.
3. Select **Other** as the use case $\rightarrow$ Choose **Business**.
4. Set an **App Name** and contact email.
5. In the App Dashboard, locate **WhatsApp** and click **Set Up**.

---

### Step 3: Add and Verify Your Real Phone Number
1. In the App Dashboard left sidebar, navigate to **WhatsApp $\rightarrow$ API Setup**.
2. Scroll down to **Step 5: Add a Phone Number** and click **Add Phone Number**.
3. Fill in your business profile details:
   - **Display Name**: Your brand or marketplace name.
   - **Category**: (e.g., Retail, Shopping, Marketplace).
   - **Timezone & Description**.
4. Enter your real phone number and choose **SMS** or **Voice Call**.
5. Enter the 6-digit OTP received on your phone to complete verification.
6. Once verified, copy the generated **Phone Number ID** (a 15-16 digit number).

---

### Step 4: Generate a Permanent Access Token (Never Expires)
*(Temporary tokens in the developer dashboard expire after 24 hours. A System User token never expires.)*

1. Open **[business.facebook.com](https://business.facebook.com/)** $\rightarrow$ Go to **Business Settings**.
2. Under **Users**, click **System Users** $\rightarrow$ Click **Add**.
3. Name the system user (e.g., `whatsapp-bot-admin`) and assign the **Admin** role.
4. Click **Add Assets** $\rightarrow$ Select **Apps** $\rightarrow$ Choose your WhatsApp App $\rightarrow$ Turn on **Full Control (Manage App)** $\rightarrow$ Save.
5. Click **Generate New Token**:
   - Select your WhatsApp App.
   - Token Expiration: **Never**.
   - Select required permissions:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
6. Click **Generate Token** and store this secret securely.

---

### Step 5: Configure Inbound Webhooks
1. In the Meta Developer Portal, go to **WhatsApp $\rightarrow$ Configuration**.
2. Under **Webhook**, click **Edit**.
3. Set your server endpoint: `https://<your-domain>/webhooks/whatsapp`.
4. Set a custom secret **Verify Token** (a random string you choose, e.g., `my_secret_token_123`).
5. Click **Verify and Save**.
6. Under **Webhook Fields**, click **Manage** and subscribe to:
   - `messages` (inbound replies and stop commands).
   - `message_template_status_update` (template approvals).

---

## 2. Messaging Architecture & Workflow

The engine follows an event-driven, delayed-execution pipeline with safety guardrails to ensure high deliverability and prevent spam.

```
[Application Trigger / Event]
            │ (e.g. Buyer sent message, Offer made, Payment pending)
            ▼
[Delayed Job Queue]
            │ (Wait 15m / 30m / 60m before taking action)
            ▼
[Precondition Re-Verification]
            │ ──> Did the seller reply in the last 30 minutes?
            │      ├─ YES ──> Cancel action (Skip message)
            │      └─ NO  ──> Proceed
            ▼
[Safety & Guardrail Engine]
            │ ──> Is user.whatsappOptIn == true?
            │ ──> Has user opted out (STOP / إلغاء)?
            │ ──> Is it quiet hours (11 PM - 8 AM in user's timezone)? ──> If YES: defer to 8 AM
            │ ──> Has user received >= 3 messages for this topic in 24h? ──> If YES: rate limit skip
            ▼
[Outbound WhatsApp Send via Meta API]
            │
            ▼
[Inbound Webhook Listener]
            ├─ Delivery Receipts (Sent ➔ Delivered ➔ Read)
            └─ Inbound Messages (Detect "STOP" / "إيقاف" ➔ Set optIn = false)
```

### Key Stages Explained:
1. **State-Light Queuing:** Jobs stored in the queue contain only an `actionId` or `userId`. When the job wakes up after 30 minutes, it queries the database fresh. This ensures real-time decisions.
2. **Precondition Checks:** If a seller replies 5 minutes after a buyer's inquiry, the 30-minute reminder job will detect the reply and cancel itself automatically.
3. **Idempotency:** Each action uses an idempotency key (e.g., `ACTION_TYPE:USER_ID:LISTING_ID:EVENT_ID`) so duplicate triggers never produce duplicate messages.

---

## 3. Free Tier Allowances & Keeping Costs at $0

Meta provides the following free tier structure for the WhatsApp Cloud API:

| Feature | Free Allowance | Details |
|---|---|---|
| **Test Sandbox** | **Unlimited** | Message up to 5 verified test phone numbers for free without limits. |
| **Service (User-Initiated) Conversations** | **1,000 free / month** | When a customer messages your business number, a **24-hour service window** opens. All replies inside this window are completely free. The first 1,000 windows per month are $0. |
| **Platform Maintenance Fee** | **$0 / Month** | Meta charges zero recurring subscription or maintenance fees for API access. |

### How to Stay 100% Free:
1. **Leverage the 24-Hour Customer Care Window:** Whenever a user reaches out first, all two-way messaging within 24 hours is free.
2. **Operate Within the 1,000 Monthly Free Conversations:** For early-stage and MVP projects, 1,000 monthly conversations is sufficient for core growth notifications.
3. **Use Sandbox for Development:** Run local and staging environments against Meta test numbers to incur zero usage.

---

## 4. Anti-Ban Playbook: Protecting Your Number

WhatsApp uses automated algorithms and user feedback to detect spam. If users repeatedly click **"Block"** or **"Report as Spam"**, your number will receive a low Quality Rating or be banned.

### The 7 Golden Rules of Number Safety

#### 1. Explicit Opt-In Only
* Only send messages to users who explicitly consented (e.g., a checked box during signup: *"Send me order and deal updates via WhatsApp"*).
* **Never** purchase phone lists or send cold, unsolicited messages.

#### 2. Instant Keyword Opt-Out
* Meta enforces strict user opt-out compliance.
* Listen for English and Arabic opt-out words:
  `['stop', 'unsubscribe', 'إيقاف', 'ايقاف', 'وقف', 'الغاء', 'إلغاء']`
* When detected:
  1. Immediately set `user.whatsappOptIn = false` in your database.
  2. Send a single polite confirmation: *"You have been unsubscribed."*
  3. Never send another automated message to that number.

#### 3. Respect Quiet Hours (Timezone Aware)
* Never send automated notifications during late night/early morning hours (e.g., **11:00 PM to 8:00 AM** in the recipient's timezone).
* If an event triggers at 1:00 AM, calculate the next allowed time (**8:00 AM the next morning**) and reschedule the message. Waking users up is the primary cause of spam reports.

#### 4. Hard 24-Hour Frequency Caps
* Enforce a hard ceiling: maximum **3 messages per user per listing/topic in a 24-hour window**.
* Do not spam multiple reminders for the same event.

#### 5. Phone Number Warming Schedule
If using a brand new phone number, ramp up your sending volume gradually:
* **Days 1–3:** 10–20 messages / day.
* **Days 4–7:** 50–100 messages / day.
* **Week 2:** 200–500 messages / day.
* **Week 3+:** Full production volume.

#### 6. Always Re-Verify State (No Stale Messages)
* Never send a reminder to complete an action if the user already completed it (e.g., reminder to pay after they already paid).

#### 7. Add Random Jitter Delays Between Messages
* If a background worker is dispatching multiple messages, add a random delay of **3 to 8 seconds** between consecutive API calls to prevent unnatural spikes.

---

## 5. Core Data Models & Webhook Specification

### A. Minimal Database Tables Required

#### Users Table
- `id` (String / UUID)
- `phone_e164` (String, e.g., `+966500000001`)
- `whatsapp_opt_in` (Boolean, default `false`)
- `whatsapp_opted_out_at` (Timestamp, nullable)
- `timezone` (String, default `Asia/Riyadh`)

#### WhatsApp Messages Table
- `id` (UUID)
- `user_id` (Foreign Key)
- `recipient_phone` (String)
- `template_name` (String)
- `meta_message_id` (String, unique)
- `status` (`PENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`, `USER_REPLIED`, `SKIPPED`)
- `sent_at` (Timestamp)
- `error` (Text, nullable)

---

### B. Webhook Handshake Specification

#### GET Request (Verification Challenge)
When registering the webhook in Meta:
* **Query Parameters:**
  - `hub.mode`: `"subscribe"`
  - `hub.verify_token`: Your secret string
  - `hub.challenge`: Random string from Meta
* **Expected Response:** Return `hub.challenge` as plain text with HTTP status `200`.

#### POST Request (Events & Inbound Messages)
Meta sends JSON payloads containing message statuses and incoming user texts:
* **Delivery Status Update:**
  ```json
  {
    "entry": [{
      "changes": [{
        "value": {
          "statuses": [{
            "id": "wamid.HBgL...",
            "status": "delivered",
            "timestamp": "1719230000"
          }]
        }
      }]
    }]
  }
  ```
* **Incoming Customer Reply / Opt-Out:**
  ```json
  {
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "966500000001",
            "id": "wamid.HBgL...",
            "text": { "body": "إيقاف" },
            "type": "text"
          }]
        }
      }]
    }]
  }
  ```

---

### C. Outbound HTTP Request Specification

To send a template message via Meta Cloud API:

* **Endpoint:** `POST https://graph.facebook.com/v23.0/<PHONE_NUMBER_ID>/messages`
* **Headers:**
  - `Authorization: Bearer <PERMANENT_ACCESS_TOKEN>`
  - `Content-Type: application/json`
* **Payload:**
  ```json
  {
    "messaging_product": "whatsapp",
    "to": "966500000001",
    "type": "template",
    "template": {
      "name": "seller_reply_reminder",
      "language": { "code": "ar" },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "أبو ناصر" },
            { "type": "text", "text": "آيفون 15 برو" },
            { "type": "text", "text": "https://www.yourdomain.com/item/123" }
          ]
        }
      ]
    }
  }
  ```
