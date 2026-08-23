#!/usr/bin/env python3
"""
Meta WhatsApp Cloud API Webhook & Automation Server
===================================================
Production-ready FastAPI service designed for 1-click deployment on Render.

Endpoints:
- GET  /                : Service status & health check
- GET  /webhook         : Meta WhatsApp Cloud API verification handshake
- POST /webhook         : Inbound message handler & STOP opt-out listener
- POST /api/send        : Send single WhatsApp template message
- POST /api/campaign    : Trigger background batch campaign from Excel
- GET  /api/status      : Campaign progress monitoring
"""

import os
import sys
import json
import time
import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

import requests
import pandas as pd
from fastapi import FastAPI, Request, Response, Query, BackgroundTasks, HTTPException
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel

# Configuration from Environment (Render sets these)
META_PHONE_NUMBER_ID = os.getenv("META_PHONE_NUMBER_ID", "")
META_ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN", "")
META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "my_secret_verify_token_123")
META_TEMPLATE_NAME = os.getenv("META_TEMPLATE_NAME", "haraj_ad_inquiry")
META_LANGUAGE_CODE = os.getenv("META_LANGUAGE_CODE", "ar")
META_API_VERSION = os.getenv("META_API_VERSION", "v20.0")
EXCEL_FILE_PATH = os.getenv("EXCEL_FILE", "haraj_numbers.xlsx")
DELAY_SECONDS = int(os.getenv("DELAY_SECONDS", "3"))

OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "إيقاف", "ايقاف", "وقف", "الغاء", "إلغاء"]
OPTED_OUT_FILE = Path("opted_out_numbers.json")

app = FastAPI(
    title="Meta WhatsApp Cloud API Engine",
    version="1.0.0",
    description="Automated WhatsApp messaging & inbound webhook handler for Meta Cloud API on Render"
)

# In-memory campaign state
campaign_state = {
    "is_running": False,
    "total": 0,
    "processed": 0,
    "succeeded": 0,
    "failed": 0,
    "started_at": None,
    "last_updated": None
}


def load_opted_out() -> set:
    if OPTED_OUT_FILE.exists():
        try:
            with open(OPTED_OUT_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()


def add_opt_out(phone: str):
    phones = load_opted_out()
    phones.add(phone)
    try:
        with open(OPTED_OUT_FILE, "w", encoding="utf-8") as f:
            json.dump(list(phones), f, indent=2)
    except Exception as e:
        print(f"[!] Error saving opt-out for {phone}: {e}")


def normalize_phone(phone_val) -> str:
    if not phone_val or pd.isna(phone_val):
        return ""
    digits = "".join(ch for ch in str(phone_val).split(".")[0] if ch.isdigit())
    if digits.startswith("05") and len(digits) == 10:
        digits = "966" + digits[1:]
    elif digits.startswith("5") and len(digits) == 9:
        digits = "966" + digits
    return digits


class SendSingleRequest(BaseModel):
    phone: str
    ad_title: str
    template_name: Optional[str] = None
    language_code: Optional[str] = None


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Meta WhatsApp Cloud API Engine",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "phone_number_id_configured": bool(META_PHONE_NUMBER_ID and not META_PHONE_NUMBER_ID.startswith("YOUR_")),
        "campaign_running": campaign_state["is_running"]
    }


@app.get("/webhook")
def meta_webhook_verification(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
):
    """
    Verification endpoint required by Meta Developer Dashboard.
    When registering webhook URL on developers.facebook.com:
    - URL: https://<your-render-domain>/webhook
    - Verify Token: <META_VERIFY_TOKEN>
    """
    if hub_mode == "subscribe" and hub_verify_token == META_VERIFY_TOKEN:
        print(f"✅ Meta Webhook challenge verified successfully!")
        return PlainTextResponse(content=hub_challenge, status_code=200)
    
    print(f"❌ Webhook verification failed. Token mismatch or invalid mode.")
    return PlainTextResponse(content="Forbidden", status_code=403)


@app.post("/webhook")
async def meta_webhook_events(request: Request):
    """
    Receives incoming webhook events from Meta:
    - Inbound messages (handles STOP / opt-out)
    - Delivery statuses (SENT, DELIVERED, READ, FAILED)
    """
    try:
        body = await request.json()
    except Exception:
        return PlainTextResponse("Invalid JSON", status_code=400)

    entries = body.get("entry", [])
    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            value = change.get("value", {})

            # 1. Handle incoming customer messages
            messages = value.get("messages", [])
            for msg in messages:
                sender = msg.get("from", "")
                text_body = msg.get("text", {}).get("body", "").strip()
                print(f"📩 Incoming message from {sender}: '{text_body}'")

                # Check for opt-out keywords
                if any(kw in text_body.lower() for kw in OPT_OUT_KEYWORDS):
                    add_opt_out(sender)
                    print(f"🚫 User {sender} opted out with keyword: '{text_body}'")

            # 2. Handle message statuses
            statuses = value.get("statuses", [])
            for st in statuses:
                msg_id = st.get("id", "")
                status_type = st.get("status", "")
                recipient_id = st.get("recipient_id", "")
                print(f"📊 Delivery Status for {recipient_id} ({msg_id[:12]}...): {status_type}")

    return PlainTextResponse("EVENT_RECEIVED", status_code=200)


def send_meta_message(phone: str, ad_title: str, template: str = None, lang: str = None) -> tuple[bool, str, str]:
    if not META_PHONE_NUMBER_ID or not META_ACCESS_TOKEN:
        return False, "", "Meta credentials (META_PHONE_NUMBER_ID, META_ACCESS_TOKEN) are missing."

    # Check opt-out list
    if phone in load_opted_out():
        return False, "", f"Skipped: Number {phone} has opted out."

    template_name = template or META_TEMPLATE_NAME
    language_code = lang or META_LANGUAGE_CODE
    url = f"https://graph.facebook.com/{META_API_VERSION}/{META_PHONE_NUMBER_ID}/messages"
    
    headers = {
        "Authorization": f"Bearer {META_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(ad_title) if str(ad_title).strip() else "الإعلان"}]
                }
            ]
        }
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=25)
        data = resp.json()
        if resp.status_code == 200 and "messages" in data and len(data["messages"]) > 0:
            return True, data["messages"][0].get("id", ""), ""
        
        error_obj = data.get("error", {})
        err_msg = f"[Code {error_obj.get('code', resp.status_code)}] {error_obj.get('message', resp.text)}"
        return False, "", err_msg
    except Exception as e:
        return False, "", str(e)


@app.post("/api/send")
def api_send_single(req: SendSingleRequest):
    """Send a single WhatsApp message via Meta Cloud API."""
    clean_phone = normalize_phone(req.phone)
    if not clean_phone or len(clean_phone) < 9:
        raise HTTPException(status_code=400, detail=f"Invalid phone number format: {req.phone}")

    success, msg_id, err_msg = send_meta_message(
        clean_phone,
        req.ad_title,
        template=req.template_name,
        lang=req.language_code
    )

    if success:
        return {"success": True, "phone": clean_phone, "meta_message_id": msg_id}
    else:
        return JSONResponse(status_code=400, content={"success": False, "phone": clean_phone, "error": err_msg})


def process_campaign_task(limit: Optional[int] = None):
    global campaign_state
    excel_path = Path(EXCEL_FILE_PATH)
    if not excel_path.exists():
        print(f"❌ Campaign error: Excel file {excel_path} not found.")
        campaign_state["is_running"] = False
        return

    try:
        df = pd.read_excel(excel_path)
        for col in ["meta_sent", "meta_sent_at", "meta_msg_id", "meta_error"]:
            if col not in df.columns:
                df[col] = None

        unsent_mask = df["meta_sent"].isna() | (df["meta_sent"] == False) | (df["meta_sent"] == 0)
        unsent_df = df[unsent_mask]
        
        indices = unsent_df.index[:limit] if limit and limit > 0 else unsent_df.index
        campaign_state["total"] = len(indices)
        campaign_state["processed"] = 0
        campaign_state["succeeded"] = 0
        campaign_state["failed"] = 0
        campaign_state["started_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        for count, idx in enumerate(indices, start=1):
            raw_phone = df.at[idx, "phone"] if "phone" in df.columns else ""
            raw_ad = df.at[idx, "ad"] if "ad" in df.columns else ""
            clean_phone = normalize_phone(raw_phone)

            if not clean_phone or len(clean_phone) < 9:
                df.at[idx, "meta_sent"] = False
                df.at[idx, "meta_error"] = f"Invalid phone: {raw_phone}"
                campaign_state["failed"] += 1
            else:
                success, msg_id, err_msg = send_meta_message(clean_phone, raw_ad)
                ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                if success:
                    df.at[idx, "meta_sent"] = True
                    df.at[idx, "meta_sent_at"] = ts
                    df.at[idx, "meta_msg_id"] = msg_id
                    df.at[idx, "meta_error"] = None
                    campaign_state["succeeded"] += 1
                else:
                    df.at[idx, "meta_sent"] = False
                    df.at[idx, "meta_sent_at"] = ts
                    df.at[idx, "meta_error"] = err_msg
                    campaign_state["failed"] += 1

            campaign_state["processed"] = count
            campaign_state["last_updated"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            if count % 10 == 0:
                df.to_excel(excel_path, index=False)

            if count < len(indices):
                time.sleep(DELAY_SECONDS)

        df.to_excel(excel_path, index=False)
        print(f"🎉 Campaign completed: {campaign_state['succeeded']} sent, {campaign_state['failed']} failed.")
    except Exception as e:
        print(f"❌ Campaign execution error: {e}")
    finally:
        campaign_state["is_running"] = False


@app.post("/api/campaign/start")
def start_campaign(background_tasks: BackgroundTasks, limit: Optional[int] = None):
    """Trigger background batch sending campaign."""
    global campaign_state
    if campaign_state["is_running"]:
        return {"message": "Campaign is already running.", "status": campaign_state}

    campaign_state["is_running"] = True
    background_tasks.add_task(process_campaign_task, limit)
    return {"message": "Campaign started in background.", "limit": limit}


@app.get("/api/campaign/status")
def get_campaign_status():
    """Check campaign progress."""
    return campaign_state


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("meta_webhook_server:app", host="0.0.0.0", port=port, reload=True)
