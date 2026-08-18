# 🚀 WhatsApp Outreach & Automated Messaging Platform

A full-stack, enterprise-grade WhatsApp automated outreach and campaign management system. Built with **React**, **Node.js / Express**, **SQLite (WASM)**, and **OpenWA (Native Baileys Protocol Engine)**.

---

## 🌟 Key Features

* **Multi-Session WhatsApp Web Support:** Connect and run multiple WhatsApp numbers simultaneously via live dynamic QR codes.
* **Meta Cloud API & OpenWA Dual Engine:** Seamlessly toggle between the official Meta Cloud API and OpenWA WhatsApp Web.
* **Excel / CSV Contact Import:** Drag & drop spreadsheets, auto-detect columns, and preview parsed numbers.
* **Multi-Country E.164 Normalization:** Automatically standardizes international numbers (Saudi Arabia `+966`, Egypt `+20`, UAE `+971`, USA `+1`, UK `+44`, and 190+ countries).
* **Dynamic Message Placeholders:** Personalize messages dynamically with variables like `{{name}}`, `{{ad}}`, `{{city}}`, etc.
* **Anti-Ban Protection Playbook:**
  * 3–8s randomized dispatch jitter delays.
  * Automatic opt-out detection (`STOP`, `إلغاء`, `unsubscribe`).
  * Enforced quiet hours protection.
* **Real-time Live Stream & Metrics:** Monitor sent, delivered, and failed message receipts in real time.
* **CSV Export & Reporting:** Download timestamped delivery reports with single-click export.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React + Vite)                   │
│                    http://localhost:3000                    │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST / Axios
┌──────────────────────────────▼──────────────────────────────┐
│                  Backend (Express + Node.js)                │
│                    http://localhost:5000                    │
│      • SQLite Database (sql.js WASM)                        │
│      • Background Dispatcher & Rate Pacing Worker           │
│      • E.164 Phone Normalization & Crypto Service           │
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

Make sure your machine has the following installed:
* [Node.js](https://nodejs.org/) (v18 or v20+ recommended)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for running the OpenWA WhatsApp engine)
* [Git](https://git-scm.com/)

---

## ⚡ Quick Start Guide (Team Setup)

### 1. Clone the Repository
```bash
git clone <your-github-repo-url>
cd "Whatapp Messaging"
```

---

### 2. Launch the OpenWA WhatsApp Engine (Docker)
In a terminal, start the Baileys protocol container:
```bash
cd OpenWA
docker compose up -d
cd ..
```
> **Verification:** Open `http://localhost:2785` in your browser. You should see the OpenWA service dashboard running.

---

### 3. Start the Backend Server
In a new terminal window:
```bash
cd backend
npm install
npm run dev
```
> Backend runs on **`http://localhost:5000`** with the SQLite database automatically initialized.

---

### 4. Start the Frontend Dashboard
In another terminal window:
```bash
cd frontend
npm install
npm run dev
```
> Open your browser at **`http://localhost:3000`**.

---

## 📱 How to Use the Dashboard

### 1. Connect a WhatsApp Number
1. Navigate to **Connected Numbers** (`/whatsapp`).
2. Click **"Pair Number via Live QR"**.
3. Open WhatsApp on your phone $\rightarrow$ **Linked Devices** $\rightarrow$ **Link a Device** $\rightarrow$ Scan the QR code on your screen.
4. Enter your phone number (e.g. `+966500000000`) and click **"Save & Register Session"**.
5. *(Optional)* Click **"Add Additional Session"** to connect a second or third WhatsApp phone!

### 2. Launch an Outreach Campaign
1. Go to **Campaigns** $\rightarrow$ **"New Campaign"**.
2. **Step 1:** Select your connected WhatsApp number and upload an Excel or CSV file (you can use the included `sample_contacts.csv`).
3. **Step 2:** Map your phone and name/ad columns.
4. **Step 3:** Compose your message using `{{name}}` or `{{ad}}`.
5. **Step 4:** Review anti-ban pacing and click **"Launch Campaign"**.

---

## 🧪 Running Automated Tests

Run the full integration test suite (covering crypto security, E.164 multi-country normalization, opt-out keywords, open-wa health, and atomic transactions):

```bash
cd backend
npm test
```

---

## 📁 Repository Structure

```
├── backend/                  # Express REST API & Workers
│   ├── src/
│   │   ├── controllers/      # Route controllers (Campaign, WhatsApp, Auth, File)
│   │   ├── services/         # OpenWA, Phone, Crypto, and Logger services
│   │   ├── db/               # SQLite WASM database schema & migrations
│   │   └── routes/           # Express API route declarations
│   ├── tests/                # Jest integration test suites
│   └── uploads/              # Local storage for uploaded spreadsheets
│
├── frontend/                 # React + Vite Glassmorphic Dashboard
│   ├── src/
│   │   ├── pages/            # Dashboard, CampaignsList, CampaignWizard, WhatsAppAccounts
│   │   ├── components/       # Header, Sidebar, ConfirmModal
│   │   └── api/              # Axios instance & interceptors
│
├── OpenWA/                   # Baileys Protocol Docker Service
│   └── docker-compose.yml    # Engine container configuration on port 2785
│
├── sample_contacts.csv       # Sample spreadsheet for testing campaigns
└── README.md                 # Project documentation
```

---

## 🛡️ Security Best Practices

* **Sensitive Tokens:** WhatsApp tokens and API keys are AES-256-GCM encrypted in the database.
* **Secrets Management:** Never commit `.env` or session files to GitHub (these are pre-configured in `.gitignore`).
