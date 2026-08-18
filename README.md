# 🚀 WhatsApp Outreach & Automated Messaging Platform

A full-stack, enterprise-grade WhatsApp automated outreach and campaign management system. Built with **React (Vite)**, **Node.js (Express)**, **SQLite (WASM)**, and **OpenWA (Native Baileys Protocol Engine)**.

---

## 📑 Table of Contents
1. [🌟 Key Features](#-key-features)
2. [🏗️ System Architecture](#️-system-architecture)
3. [📋 Prerequisites](#-prerequisites)
4. [⚡ Quick Start Guide (Team Setup)](#-quick-start-guide-team-setup)
5. [🔧 Environment Variables & Configuration](#-environment-variables--configuration)
6. [🖥️ Detailed Dashboard User Guide](#️-detailed-dashboard-user-guide)
   - [1. User Registration & Login](#1-user-registration--login)
   - [2. Connecting WhatsApp Numbers (Live QR & Meta API)](#2-connecting-whatsapp-numbers-live-qr--meta-api)
   - [3. Multi-Session Management (Multiple Phone Numbers)](#3-multi-session-management-multiple-phone-numbers)
   - [4. Creating an Outreach Campaign](#4-creating-an-outreach-campaign)
   - [5. Dynamic Message Templates & Placeholders](#5-dynamic-message-templates--placeholders)
   - [6. Anti-Ban Safety Controls & Quiet Hours](#6-anti-ban-safety-controls--quiet-hours)
   - [7. Campaign Execution, Live Tracking & Retries](#7-campaign-execution-live-tracking--retries)
   - [8. CSV Report Export](#8-csv-report-export)
   - [9. Logs, System Diagnostics & Audit Trail](#9-logs-system-diagnostics--audit-trail)
   - [10. Settings & Webhook Endpoints](#10-settings--webhook-endpoints)
7. [🧪 Running Automated Tests](#-running-automated-tests)
8. [📁 Repository Structure](#-repository-structure)
9. [🛡️ Security Best Practices](#️-security-best-practices)

---

## 🌟 Key Features

* **Multi-Session WhatsApp Web Support:** Connect and run multiple WhatsApp numbers simultaneously via live dynamic QR codes.
* **Dual Engine Support:** Seamlessly toggle between **OpenWA (Baileys Engine)** and official **Meta WhatsApp Cloud API**.
* **Excel & CSV Contact Parser:** Drag & drop spreadsheets with auto-detection of phone, name, and ad columns.
* **Global E.164 Phone Normalization:** Automatically handles international country codes (Saudi Arabia `+966`, Egypt `+20`, UAE `+971`, USA `+1`, UK `+44`, etc.) and strips invalid characters.
* **Dynamic Placeholders:** Personalize outgoing texts dynamically with variables like `{{name}}`, `{{ad}}`, `{{city}}`, etc.
* **Anti-Ban Safety Playbook:**
  * 3–8s randomized dispatch jitter delays.
  * Automatic opt-out keyword detection (`STOP`, `إلغاء`, `unsubscribe`).
  * Enforced quiet hours protection (11:00 PM – 8:00 AM).
* **Live Message Delivery Matrix:** Track sent, delivered, and failed message receipts in real time.
* **1-Click CSV Report Export:** Download formatted delivery reports with timestamps and error reasons.
* **Glassmorphic Modern UI:** Dark-mode dashboard built with responsive navigation and delete confirmation modals.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React + Vite)                   │
│                    http://localhost:3000                    │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST / Axios (JWT Auth)
┌──────────────────────────────▼──────────────────────────────┐
│                  Backend (Express + Node.js)                │
│                    http://localhost:5000                    │
│      • SQLite Database (sql.js WASM Engine)                 │
│      • Native Background Dispatcher & Rate Pacer            │
│      • E.164 Multi-Country Phone Normalizer                 │
│      • AES-256-GCM Token Encryption Service                 │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
│  OpenWA WhatsApp Engine     │ │   Meta WhatsApp Cloud API   │
│  (Baileys Protocol Docker)  │ │   (Official Cloud Graph API)│
│    http://localhost:2785    │ │     https://graph.facebook  │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## 📋 Prerequisites

Ensure the following tools are installed on your system:
* [Node.js](https://nodejs.org/) (v18 or v20+ recommended)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (to run the OpenWA container)
* [GitHub Desktop](https://desktop.github.com/) (or Git CLI)

---

## ⚡ Quick Start Guide (Team Setup)

### 1. Clone the Repository
```bash
git clone <your-github-repo-url>
cd "Whatapp Messaging"
```

---

### 2. Launch the OpenWA WhatsApp Engine (Docker)
Open a terminal and start the OpenWA Baileys container:
```bash
cd OpenWA
docker compose up -d
cd ..
```
> **Verification:** Open `http://localhost:2785` in your browser. You should see the OpenWA status dashboard.

---

### 3. Start the Backend API Server
In a new terminal window:
```bash
cd backend
npm install
npm run dev
```
> Backend starts on **`http://localhost:5000`** with SQLite automatically initialized.

---

### 4. Start the Frontend Dashboard
In a separate terminal window:
```bash
cd frontend
npm install
npm run dev
```
> Open your browser at **`http://localhost:3000`**.

---

## 🔧 Environment Variables & Configuration

The project is designed with **"Zero-Config Defaults"**: team members can start the backend and frontend immediately without creating a `.env` file because safe, fully-functioning local defaults are built into the code.

However, if you or your team wish to customize ports, database paths, or encryption keys, the repository includes ready `.env.example` templates across all layers.

### 1. Setting Up Your Custom `.env` File
```bash
# In the backend directory:
cd backend
cp .env.example .env
```

### 2. Backend Environment Variables Reference (`backend/.env`)

| Variable Name | Default Value | Description |
|---|---|---|
| `PORT` | `5000` | Port on which the Express REST API backend listens. |
| `NODE_ENV` | `development` | Environment mode (`development` or `production`). |
| `SQLITE_DB_PATH` | `./data/whatsapp.sqlite` | Filepath for the SQLite WASM persistent database. |
| `JWT_SECRET` | `super_secret_jwt_key_...` | Secret key used to sign and verify user JWT authentication tokens. |
| `ENCRYPTION_KEY` | `0123456789abcdef...` | 32-byte hexadecimal key for AES-256-GCM token & API key encryption. |
| `OPENWA_GATEWAY_URL` | `http://localhost:2785` | URL of the local OpenWA Baileys WhatsApp container. |
| `OPENWA_API_KEY` | `owa_k1_b6e2f426...` | Master API Key configured in the OpenWA engine. |
| `N8N_WEBHOOK_URL` | `http://localhost:5678/...` | Optional n8n workflow dispatch webhook endpoint. |
| `N8N_CALLBACK_SECRET`| `whatsapp_dashboard_...` | Shared secret to verify dispatch callbacks from n8n. |
| `META_VERIFY_TOKEN` | `whatsapp_meta_...` | Custom token used for Meta WhatsApp Webhook handshake verification. |
| `FRONTEND_URL` | `http://localhost:3000` | Base URL of the frontend dashboard (used for CORS policy). |

---

### 3. OpenWA Engine Environment Variables Reference (`OpenWA/.env`)

| Variable Name | Default Value | Description |
|---|---|---|
| `PORT` | `2785` | Port on which the OpenWA Baileys container and dashboard run. |
| `API_MASTER_KEY` | `owa_k1_b6e2f426...` | Master authentication key for REST API calls into OpenWA. |
| `LOG_LEVEL` | `info` | Container logging level (`info`, `debug`, `warn`, `error`). |
| `NODE_ID` | `openwa-main-node` | Identifier for the OpenWA node instance. |
| `WWEBJS_WEB_VERSION`| `off` | WhatsApp Web version pinning setting. |
| `WWEBJS_AUTH_TIMEOUT_MS` | `120000` | Pairing and connection timeout threshold (in milliseconds). |

---

## 🖥️ Detailed Dashboard User Guide

### 1. User Registration & Login
1. Open `http://localhost:3000` in your browser.
2. If you don't have an account, click **"Register"** to create a local account with your email and password.
3. Once logged in, your session is authenticated via JWT and stored securely in `localStorage`.

---

### 2. Connecting WhatsApp Numbers (Live QR & Meta API)
Navigate to **WhatsApp Numbers** (`/whatsapp`) from the left sidebar:

#### Option A: Pair via Live QR (OpenWA Engine)
1. Click **"Pair Number via Live QR"**.
2. A modal will appear displaying a live dynamic QR code streamed directly from the Baileys engine.
3. Open WhatsApp on your mobile phone:
   * Go to **Settings** $\rightarrow$ **Linked Devices** $\rightarrow$ **Link a Device**.
   * Scan the QR code shown on your dashboard.
4. Enter your phone number with country code (e.g. `+966500000001` or `+201128247939`) and give the account a label (e.g. `Sales Team Riyadh`).
5. Click **"Save & Register Session"**.

#### Option B: Connect Official Meta Cloud API
1. Click **"Connect Meta Cloud API"**.
2. Enter your credentials from the [Meta for Developers Portal](https://developers.facebook.com/):
   * **Phone Number (E.164):** e.g. `+966500000000`
   * **Phone Number ID:** (from your WhatsApp App dashboard)
   * **WABA ID:** (WhatsApp Business Account ID)
   * **Access Token:** Permanent System User Access Token
3. Click **"Save & Connect"**.

---

### 3. Multi-Session Management (Multiple Phone Numbers)
You can connect and run **multiple WhatsApp numbers simultaneously**:
* Click **"Add Additional Session"** on the WhatsApp Numbers page.
* Each session receives a unique identifier (e.g., `session-2`, `sales-rep-2`).
* When launching campaigns, you can choose which connected phone number dispatches that specific campaign.
* **Auto-Sync Detected Sessions:** If an existing session is already paired on your Docker engine, the dashboard will display an **"Active Connected Session Found"** prompt allowing you to sync it with 1 click.
* **Session Deletion:** Clicking the red trash icon on any account card cleanly disconnects the session from Docker and deletes it from the database.

---

### 4. Creating an Outreach Campaign
Click **"New Campaign"** (or go to `/campaigns/new`) to open the 4-step wizard:

#### Step 1: Campaign Details & Spreadsheet Upload
* **Campaign Name:** Enter a descriptive name (e.g. `Haraj Riyadh Car Inquiries`).
* **Sender WhatsApp Number:** Select which connected number will send the messages.
* **Upload Excel / CSV:** Drag & drop your `.xlsx`, `.xls`, or `.csv` contact spreadsheet (or use the included `sample_contacts.csv`).

#### Step 2: Column Mapping & Live Number Validation
* The system automatically scans your spreadsheet headers.
* Map the required fields:
  * **Phone Number Column:** (e.g. `Phone Number`, `جوال`, `Mobile`)
  * **Contact Name Column:** (e.g. `Name`, `الاسم`)
  * **Ad Title / Custom Column:** (e.g. `Ad Title`, `الإعلان`)
* Click **"Validate & Preview"** to inspect how numbers are cleaned into standard international E.164 formats (+966, +20, etc.).

#### Step 3: Message Template & Dynamic Placeholders
* Write your message body. Insert variables inside double curly braces:
  ```text
  السلام عليكم ورحمة الله يا {{name}}، بخصوص إعلانك "{{ad}}"، هل السلعة ما زالت متوفرة؟
  ```
* Review the live WhatsApp chat preview box to see how the rendered message will appear to recipients.

#### Step 4: Safety Guardrails & Dispatch
* Verify the safety settings:
  * **Anti-Ban Randomized Jitter:** Enforces 3–8s delays between outgoing messages.
  * **Quiet Hours Protection:** Check this box to prevent dispatches between 11:00 PM and 8:00 AM in the recipient's timezone.
* Click **"Launch Campaign"**.

---

### 5. Dynamic Message Templates & Placeholders
You can use any column header from your uploaded file as a variable:
| Variable Syntax | Spreadsheet Column | Example Output |
|---|---|---|
| `{{name}}` | Name, الاسم | Ahmed Al-Otaibi |
| `{{ad}}` | Ad Title, الإعلان | Toyota Camry 2023 |
| `{{city}}` | City, المدينة | Riyadh |

---

### 6. Anti-Ban Safety Controls & Quiet Hours
The platform includes built-in anti-ban protection to safeguard your numbers:
1. **Randomized Delay Jitter:** Adds random intervals (3 to 8 seconds) between consecutive message dispatches.
2. **Opt-Out Watcher:** Automatically detects recipient opt-out keywords (`STOP`, `إلغاء`, `وقف`, `unsubscribe`) and halts further automated outreach to that number.
3. **Quiet Hours Protection:** Prevents midnight messaging disruptions.

---

### 7. Campaign Execution, Live Tracking & Retries
Once launched, you are redirected to the **Campaign Details** view (`/campaigns/:id`):
* **Execution Progress Bar:** Shows real-time percentage completed.
* **Metrics Matrix:** Live counts for `Total Contacts`, `Sent`, `Delivered`, and `Failed`.
* **Action Controls:**
  * **Pause:** Temporarily suspend outgoing message queue.
  * **Start / Resume:** Continue message dispatching.
  * **Retry Failed:** Re-attempts delivery for numbers that encountered network timeouts.
  * **Cancel:** Halts all pending unsent contacts.
  * **Delete:** Permanently removes the campaign and message history.

---

### 8. CSV Report Export
On any campaign details page, click **"Export CSV"** to download a spreadsheet containing:
* Recipient phone number (E.164 format)
* Delivery status (`SENT`, `DELIVERED`, `FAILED`, `PENDING`)
* Timestamp of delivery
* Error details (if any delivery failed)

---

### 9. Logs, System Diagnostics & Audit Trail
Navigate to **Diagnostics** (`/logs`) from the sidebar:
* **Messages Tab:** Inspect all outgoing WhatsApp delivery receipts, recipient phone numbers, and timestamps.
* **Backend Errors Tab:** Inspect raw server logs, network connection warnings, and stack traces.
* **Clear Logs:** Click **"Clear Logs"** with confirmation modal to purge error history from SQLite.

---

### 10. Settings & Webhook Endpoints
Navigate to **Settings** (`/settings`):
* **Meta Inbound Webhook:** View the webhook URL (`/api/v1/webhooks/meta-whatsapp`) and verify token for Meta Cloud API integration.
* **n8n Automation Engine:** View the dispatch endpoint for workflow automation.

---

## 🧪 Running Automated Tests

Run the full integration test suite in the backend directory:

```bash
cd backend
npm test
```

---

## 📁 Repository Structure

```
├── backend/                  # Express REST API Server
│   ├── src/
│   │   ├── controllers/      # Route handlers (Campaign, WhatsApp, Auth, File)
│   │   ├── services/         # OpenWA, Phone, Crypto, and Logger services
│   │   ├── db/               # SQLite WASM database schema & migrations
│   │   └── routes/           # API route declarations
│   ├── tests/                # Jest integration test suites
│   └── uploads/              # Local storage for uploaded spreadsheets
│
├── frontend/                 # React + Vite Glassmorphic Dashboard
│   ├── src/
│   │   ├── pages/            # Dashboard, Campaigns, Wizard, WhatsApp, Logs
│   │   ├── components/       # Header, Sidebar, ConfirmModal
│   │   └── api/              # Axios instance & JWT interceptor
│
├── OpenWA/                   # Baileys Protocol Docker Service
│   └── docker-compose.yml    # Engine container configuration on port 2785
│
├── sample_contacts.csv       # Sample spreadsheet for testing campaigns
└── README.md                 # Full project documentation
```

---

## 🛡️ Security Best Practices

* **AES-256-GCM Encryption:** All WhatsApp tokens and access keys are encrypted before storage in SQLite.
* **Pre-configured `.gitignore`:** Passwords, `.env` files, `.sqlite` databases, and session directories are excluded from Git commits.
