# WhatsApp Automation Dashboard — API Specification

Base URL: `http://localhost:5000/api/v1`

All protected endpoints require an `Authorization: Bearer <JWT_TOKEN>` header.

---

## 1. Authentication Endpoints

### `POST /auth/register`
Creates a new tenant user account.
* **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!",
    "fullName": "Ahmed Al-Ghamdi",
    "companyName": "Acme Media"
  }
  ```
* **Response (201):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "user": { "id": "uuid", "email": "user@example.com", "fullName": "Ahmed Al-Ghamdi" }
  }
  ```

### `POST /auth/login`
Authenticates a user and returns a JWT token.
* **Request Body:**
  ```json
  { "email": "user@example.com", "password": "Password123!" }
  ```

### `GET /auth/me`
Fetches authenticated user profile.

---

## 2. WhatsApp Accounts Endpoints

### `GET /whatsapp/accounts`
Lists all WhatsApp numbers connected by the authenticated user.

### `POST /whatsapp/accounts`
Connects a WhatsApp number via Meta Cloud API or open-wa.
* **Request Body (Meta Cloud API):**
  ```json
  {
    "accountName": "Sales Number 1",
    "phoneNumber": "+966500000001",
    "providerType": "META_CLOUD_API",
    "phoneNumberId": "105938291049281",
    "wabaId": "982710482910291",
    "accessToken": "EAABwzLix..."
  }
  ```

### `POST /whatsapp/accounts/:id/test`
Sends a test WhatsApp message.
* **Request Body:**
  ```json
  { "recipientPhone": "+966500000002", "message": "Test delivery" }
  ```

### `DELETE /whatsapp/accounts/:id`
Disconnects and removes the specified account.

---

## 3. Files & Contact Mapping Endpoints

### `POST /files/upload`
Uploads an `.xlsx`, `.xls`, or `.csv` file (`multipart/form-data`).
* **Response (201):**
  ```json
  {
    "success": true,
    "file": {
      "id": "file-uuid",
      "fileName": "contacts.xlsx",
      "rowCount": 2500,
      "detectedColumns": ["phone", "name", "ad", "price"]
    }
  }
  ```

### `POST /files/:id/validate-mapping`
Validates Excel rows against user-defined column mapping and normalizes phone numbers into E.164.
* **Request Body:**
  ```json
  {
    "columnMapping": {
      "phoneColumn": "phone",
      "name": "name",
      "ad": "ad"
    }
  }
  ```

---

## 4. Campaign Endpoints

### `POST /campaigns`
Creates a new campaign with validated contacts and message template.
* **Request Body:**
  ```json
  {
    "name": "Haraj Car Sellers Campaign",
    "whatsappAccountId": "acc-uuid",
    "uploadedFileId": "file-uuid",
    "messageType": "TEXT",
    "messageBody": "السلام عليكم، شفت إعلانك {{ad}} في حراج...",
    "columnMapping": { "phoneColumn": "phone", "ad": "ad" },
    "sendDelaySeconds": 10,
    "respectQuietHours": true
  }
  ```

### `GET /campaigns`
Lists user campaigns with progress and status statistics.

### `GET /campaigns/:id`
Retrieves detailed status and contact breakdown for a campaign.

### `POST /campaigns/:id/start`
Dispatches campaign contacts to the n8n automation engine.

### `POST /campaigns/:id/pause`
Pauses the campaign queue.

### `POST /campaigns/:id/retry-failed`
Resets failed contacts to `PENDING` for re-execution.

---

## 5. Webhook Endpoints

### `GET /webhooks/meta-whatsapp`
Meta Webhook handshake challenge (`hub.mode`, `hub.verify_token`, `hub.challenge`).

### `POST /webhooks/meta-whatsapp`
Meta incoming delivery status updates (`delivered`, `read`) and incoming messages (opt-out keyword detection `STOP` / `إيقاف`).

### `POST /webhooks/n8n/status`
n8n execution status callback reporting individual message sent/failed outcomes.
* **Request Body:**
  ```json
  {
    "campaignId": "camp-uuid",
    "campaignContactId": "contact-uuid",
    "phone": "966500000001",
    "status": "SENT",
    "providerMessageId": "wamid.HBgL...",
    "error": null
  }
  ```
