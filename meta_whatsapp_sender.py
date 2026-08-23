#!/usr/bin/env python3
"""
Meta WhatsApp Cloud API Automation Sender
==========================================
Standalone script to send automated WhatsApp template messages using the
Official Meta Cloud API. Operates completely independently from open-wa.

Features:
- Reads contact list from Excel (haraj_numbers.xlsx)
- Cleans and formats phone numbers to international E.164 standard
- Sends official Meta WhatsApp approved templates
- Tracks sent status, Meta wamid ID, timestamps, and error messages
- Supports dry-run mode, batch limits, and rate-pacing delays
"""

import os
import sys
import json
import time
import argparse
import datetime
from pathlib import Path
import requests
import pandas as pd

# Fix Windows console UTF-8 output encoding
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass



def load_config():
    """Load configuration from meta_config.json or environment variables."""
    config_path = Path(__file__).parent / "meta_config.json"
    config = {
        "phone_number_id": os.getenv("META_PHONE_NUMBER_ID", ""),
        "access_token": os.getenv("META_ACCESS_TOKEN", ""),
        "template_name": os.getenv("META_TEMPLATE_NAME", "haraj_ad_inquiry"),
        "language_code": os.getenv("META_LANGUAGE_CODE", "ar"),
        "api_version": os.getenv("META_API_VERSION", "v20.0"),
        "excel_file": os.getenv("EXCEL_FILE", "haraj_numbers.xlsx"),
        "delay_seconds": int(os.getenv("DELAY_SECONDS", 3)),
        "max_retries": int(os.getenv("MAX_RETRIES", 3))
    }

    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                file_config = json.load(f)
                for key, val in file_config.items():
                    if val and not config.get(key):
                        config[key] = val
                    elif val and config.get(key) in ["", "YOUR_META_PHONE_NUMBER_ID", "YOUR_PERMANENT_SYSTEM_USER_ACCESS_TOKEN"]:
                        config[key] = val
        except Exception as e:
            print(f"[!] Warning reading meta_config.json: {e}")

    return config


def normalize_phone(phone_val) -> str:
    """Normalize phone number to digits only (e.g. 9665XXXXXXXX)."""
    if pd.isna(phone_val):
        return ""
    # Convert float / int / str to clean string
    phone_str = str(phone_val).split(".")[0].strip()
    digits = "".join(ch for ch in phone_str if ch.isdigit())
    
    # If starts with '05' (Saudi local), prepend '966' -> '9665...'
    if digits.startswith("05") and len(digits) == 10:
        digits = "966" + digits[1:]
    # If starts with '5' (9 digits), prepend '966' -> '9665...'
    elif digits.startswith("5") and len(digits) == 9:
        digits = "966" + digits
    
    return digits


def send_meta_template(phone: str, ad_title: str, config: dict) -> tuple[bool, str, str]:
    """
    Sends a Meta WhatsApp template message.
    Returns (success: bool, meta_msg_id: str, error_msg: str)
    """
    phone_number_id = config["phone_number_id"]
    access_token = config["access_token"]
    api_version = config.get("api_version", "v20.0")
    template_name = config["template_name"]
    language_code = config.get("language_code", "ar")

    url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    # Meta Cloud API Template Payload
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {
                "code": language_code
            },
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {
                            "type": "text",
                            "text": str(ad_title) if str(ad_title).strip() else "الإعلان"
                        }
                    ]
                }
            ]
        }
    }

    for attempt in range(1, config.get("max_retries", 3) + 1):
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=25)
            data = resp.json()

            if resp.status_code == 200 and "messages" in data and len(data["messages"]) > 0:
                msg_id = data["messages"][0].get("id", "")
                return True, msg_id, ""
            
            # Extract Meta API error message
            error_obj = data.get("error", {})
            err_msg = error_obj.get("message", f"HTTP {resp.status_code}: {resp.text}")
            err_code = error_obj.get("code", "")
            full_err = f"[Code {err_code}] {err_msg}"

            # If rate limited (e.g. code 80007 / 130429), wait and retry
            if resp.status_code in [429, 500, 503] and attempt < config.get("max_retries", 3):
                time.sleep(attempt * 4)
                continue

            return False, "", full_err

        except requests.RequestException as e:
            if attempt < config.get("max_retries", 3):
                time.sleep(attempt * 3)
                continue
            return False, "", f"Network error: {str(e)}"

    return False, "", "Exceeded maximum retry attempts"


def run_sender(dry_run: bool = False, limit: int = None):
    config = load_config()

    print("=" * 60)
    print("🚀 Meta WhatsApp Cloud API Automation Sender")
    print("=" * 60)

    # Validate essential credentials if not in dry-run
    if not dry_run:
        if not config["phone_number_id"] or config["phone_number_id"].startswith("YOUR_"):
            print("❌ ERROR: 'phone_number_id' is missing in meta_config.json or environment.")
            sys.exit(1)
        if not config["access_token"] or config["access_token"].startswith("YOUR_"):
            print("❌ ERROR: 'access_token' is missing in meta_config.json or environment.")
            sys.exit(1)

    excel_file = Path(config["excel_file"])
    if not excel_file.is_absolute():
        excel_file = Path(__file__).parent / excel_file

    if not excel_file.exists():
        print(f"❌ ERROR: Excel file '{excel_file}' not found.")
        sys.exit(1)

    print(f"📄 Reading target list: {excel_file.name}")
    df = pd.read_excel(excel_file)
    print(f"📊 Total records found: {len(df)}")

    # Ensure required tracking columns exist
    for col in ["meta_sent", "meta_sent_at", "meta_msg_id", "meta_error"]:
        if col not in df.columns:
            df[col] = None

    # Filter unsent rows
    unsent_mask = df["meta_sent"].isna() | (df["meta_sent"] == False) | (df["meta_sent"] == 0)
    unsent_df = df[unsent_mask]
    total_unsent = len(unsent_df)
    print(f"🎯 Unsent contacts pending: {total_unsent}")

    if total_unsent == 0:
        print("✅ All contacts have already been messaged via Meta API. Nothing to do.")
        return

    if limit and limit > 0:
        print(f"⚠️ Limit applied: processing first {limit} unsent rows only.")
        indices_to_process = unsent_df.index[:limit]
    else:
        indices_to_process = unsent_df.index

    print("-" * 60)
    if dry_run:
        print("🔍 [DRY-RUN MODE ENABLED] - No actual WhatsApp messages will be dispatched.")
    print("-" * 60)

    success_count = 0
    fail_count = 0

    try:
        for count, idx in enumerate(indices_to_process, start=1):
            raw_phone = df.at[idx, "phone"] if "phone" in df.columns else ""
            raw_ad = df.at[idx, "ad"] if "ad" in df.columns else ""
            
            clean_phone = normalize_phone(raw_phone)
            if not clean_phone or len(clean_phone) < 9:
                print(f"[{count}/{len(indices_to_process)}] ⚠️ Row #{idx}: Invalid phone '{raw_phone}'. Skipping.")
                df.at[idx, "meta_sent"] = False
                df.at[idx, "meta_error"] = f"Invalid phone format: {raw_phone}"
                fail_count += 1
                continue

            ad_display = str(raw_ad)[:35] + ("..." if len(str(raw_ad)) > 35 else "")

            if dry_run:
                print(f"[{count}/{len(indices_to_process)}] 🧪 [DRY-RUN] To: +{clean_phone} | Ad: '{ad_display}'")
                success_count += 1
                time.sleep(0.1)
                continue

            print(f"[{count}/{len(indices_to_process)}] 📤 Sending to +{clean_phone} ('{ad_display}')...", end=" ", flush=True)
            success, msg_id, err_msg = send_meta_template(clean_phone, raw_ad, config)

            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            if success:
                print(f"✅ OK (ID: {msg_id[:16]}...)")
                df.at[idx, "meta_sent"] = True
                df.at[idx, "meta_sent_at"] = timestamp
                df.at[idx, "meta_msg_id"] = msg_id
                df.at[idx, "meta_error"] = None
                success_count += 1
            else:
                print(f"❌ Failed: {err_msg}")
                df.at[idx, "meta_sent"] = False
                df.at[idx, "meta_sent_at"] = timestamp
                df.at[idx, "meta_error"] = err_msg
                fail_count += 1

            # Save progress incrementally every 10 rows
            if count % 10 == 0:
                df.to_excel(excel_file, index=False)

            # Rate-limiting delay between messages
            if count < len(indices_to_process):
                time.sleep(config.get("delay_seconds", 3))

    except KeyboardInterrupt:
        print("\n\n🛑 Automation interrupted by user! Saving progress...")
    finally:
        if not dry_run:
            df.to_excel(excel_file, index=False)
            print(f"💾 Updated Excel file saved to: {excel_file.name}")

    print("=" * 60)
    print(f"🎉 Summary: {success_count} succeeded, {fail_count} failed out of {len(indices_to_process)} processed.")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Meta WhatsApp Cloud API Automation")
    parser.add_argument("--dry-run", action="store_true", help="Simulate execution without sending API calls")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of messages to send in this run")
    args = parser.parse_args()

    run_sender(dry_run=args.dry_run, limit=args.limit)
