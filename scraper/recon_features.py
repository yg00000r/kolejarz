"""
Feature discovery — skanuje WSZYSTKIE endpointy z sync URL,
zbiera dane z duty-details, messages, crew, timecards itd.

Użycie:
  python recon_features.py --login <PORTAL_USER> --password <PORTAL_PASSWORD>
"""

import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright, Page

PORTAL = "http://portal.intercity.pl"
MBWEB = "/mbweb/main/matter/desktop"
OUTPUT_DIR = Path(__file__).parent / "recon_output"


def setup_output():
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = OUTPUT_DIR / f"features_{ts}"
    out.mkdir(parents=True, exist_ok=True)
    return out


def save_json(out, name, data):
    with open(out / name, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    print(f"  💾 {name}")


def do_login(page: Page, username: str, password: str) -> bool:
    page.goto(PORTAL, timeout=30000)
    time.sleep(3)
    try:
        page.wait_for_selector('input[type="text"], input[type="password"]', timeout=15000)
    except Exception:
        print(f"  ❌ No login form. URL={page.url}")
        return False
    page.locator('input[type="text"]').first.fill(username)
    page.locator('input[type="password"]').first.fill(password)
    time.sleep(0.5)
    try:
        page.locator('button[type="submit"]').first.click()
    except Exception:
        page.locator('input[type="password"]').first.press("Enter")
    time.sleep(8)
    try:
        page.wait_for_load_state("networkidle", timeout=20000)
    except Exception:
        pass
    # Wait for initial sync
    for _ in range(6):
        if "pierwsza wizyta" in page.inner_text("body").lower():
            time.sleep(5)
        else:
            break
    cookies = page.context.cookies()
    return any(c["name"] == "IvuPadAuthToken" for c in cookies)


def fetch_endpoint(page: Page, path: str) -> dict:
    """Fetch an mbweb endpoint and return parsed result."""
    url = f"{PORTAL}/mbweb/main/matter/desktop/{path}" if not path.startswith("/") else f"{PORTAL}{path}"
    try:
        resp = page.request.get(url, timeout=15000)
        ct = resp.headers.get("content-type", "")
        body = ""
        if any(t in ct for t in ["json", "text", "html", "xml"]):
            try:
                body = resp.text()
            except Exception:
                pass
        return {"status": resp.status, "content_type": ct, "body": body, "url": url}
    except Exception as e:
        return {"status": "error", "error": str(e), "url": url}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--login", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--headed", action="store_true")
    args = parser.parse_args()

    out = setup_output()
    print(f"Output: {out}\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=not args.headed,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            locale="pl-PL",
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        )
        page = context.new_page()

        print("[1] Logging in ...")
        if not do_login(page, args.login, args.password):
            print("Login failed!")
            browser.close()
            return
        print("  ✅ Logged in\n")

        # ─── Phase 1: Get sync URL list (full API surface) ───
        print("[2] Getting sync URL list ...")
        sync_data = fetch_endpoint(page, "sync")
        if sync_data["body"]:
            try:
                sync_json = json.loads(sync_data["body"])
                save_json(out, "sync_urls.json", sync_json)
                sync_urls = sync_json.get("urls", [])
                print(f"  Found {len(sync_urls)} sync URLs:")
                for u in sync_urls:
                    print(f"    • {u}")
            except Exception:
                sync_urls = []
        else:
            sync_urls = []

        # ─── Phase 2: Fetch ALL unique endpoint patterns ───
        print(f"\n[3] Probing all sync URLs ...")
        # De-duplicate URLs by pattern (strip dates, keep unique patterns)
        seen_patterns = set()
        unique_urls = []
        for u in sync_urls:
            pattern = re.sub(r'\d{4}-\d{2}-\d{2}', 'DATE', u)
            if pattern not in seen_patterns:
                seen_patterns.add(pattern)
                unique_urls.append(u)

        results = {}
        for u in unique_urls:
            print(f"\n  📡 {u}")
            result = fetch_endpoint(page, u)
            body = result.get("body", "")

            # Summarize what we got
            if "json" in result.get("content_type", ""):
                try:
                    parsed = json.loads(body)
                    if isinstance(parsed, dict):
                        print(f"    JSON keys: {list(parsed.keys())[:10]}")
                    elif isinstance(parsed, list):
                        print(f"    JSON array: {len(parsed)} items")
                except Exception:
                    pass
            elif body:
                # Extract key elements from HTML
                titles = re.findall(r'class="title-text"[^>]*>([^<]+)', body)
                times = re.findall(r'class="time[^"]*"[^>]*>([^<]+)', body)
                dates = re.findall(r'data-date="([^"]+)"', body)
                if titles:
                    print(f"    Duties found: {titles[:10]}")
                if times:
                    print(f"    Times: {times[:10]}")
                if dates:
                    print(f"    Dates: {dates[:5]}...{dates[-3:]}" if len(dates) > 8 else f"    Dates: {dates}")

            results[u] = {
                "status": result["status"],
                "content_type": result.get("content_type", ""),
                "body_size": len(body),
                "body": body[:10000],
            }

        save_json(out, "all_endpoints.json", results)

        # ─── Phase 3: Deep dive into key features ───
        print(f"\n\n[4] Deep dive: duty-details for recent days ...")
        duty_details = {}
        employee_id = "170537919"
        test_dates = ["2026-03-01", "2026-03-05", "2026-03-10", "2026-03-15", "2026-03-20", "2026-03-21"]
        for date in test_dates:
            path = f"duty-details?beginDate={date}&allocatedEmployeeId={employee_id}"
            print(f"\n  📋 {date}")
            result = fetch_endpoint(page, path)
            body = result.get("body", "")
            duty_details[date] = {
                "status": result["status"],
                "body_size": len(body),
                "body": body,
            }
            # Parse duty details
            if body:
                # Look for duty code, times, train numbers
                duty_names = re.findall(r'class="[^"]*duty[^"]*name[^"]*"[^>]*>([^<]+)', body)
                train_nums = re.findall(r'(?:train|pociąg|Zug)[^>]*>(\d+)', body, re.I)
                all_times = re.findall(r'(\d{2}:\d{2})', body)
                stations = re.findall(r'class="[^"]*(?:station|location|stop)[^"]*"[^>]*>([^<]+)', body)
                if not duty_names:
                    duty_names = re.findall(r'title-text[^>]*>([^<]+)', body)
                if duty_names:
                    print(f"    Duty: {duty_names[:5]}")
                if all_times:
                    print(f"    Times: {all_times[:8]}")
                if stations:
                    print(f"    Stations: {stations[:8]}")
                if not duty_names and not all_times:
                    # Check if it's an empty day
                    text = re.sub(r'<[^>]+>', ' ', body)
                    text = re.sub(r'\s+', ' ', text).strip()
                    print(f"    Text preview: {text[:200]}")

        save_json(out, "duty_details.json", duty_details)

        # ─── Phase 4: Messages ───
        print(f"\n\n[5] Messages ...")
        msg_endpoints = [
            "/mbweb/main/messages-service_v1_0",
            "/mbweb/main/matter/desktop/messages",
            "/mbweb/main/matter/pad/main-menu#messages",
            "/mbweb/main/matter/pad/messages",
        ]
        msg_results = {}
        for ep in msg_endpoints:
            result = fetch_endpoint(page, ep)
            body = result.get("body", "")
            print(f"  {result['status']} {ep}  [{result.get('content_type','')}]  ({len(body)} bytes)")
            if body:
                if "json" in result.get("content_type", ""):
                    print(f"    {body[:500]}")
                else:
                    # Look for message items in HTML
                    msg_items = re.findall(r'class="[^"]*message[^"]*"[^>]*>([^<]{1,100})', body)
                    subjects = re.findall(r'class="[^"]*subject[^"]*"[^>]*>([^<]+)', body)
                    if msg_items:
                        print(f"    Messages: {msg_items[:5]}")
                    if subjects:
                        print(f"    Subjects: {subjects[:5]}")
            msg_results[ep] = {"status": result["status"], "body": body[:5000]}

        save_json(out, "messages.json", msg_results)

        # ─── Phase 5: Crew & Timecard endpoints ───
        print(f"\n\n[6] Crew, timecards, other features ...")
        extra_endpoints = [
            "crew-on-trip",
            "crew-on-trip?sync=true",
            "accounts-overview",
            "accounts-overview?sync=true",
            "any-duty",
            "any-duty?sync=true",
            "wish-request",
            "wish-request?sync=true",
            "timecard",
            "timecards",
            "actual-duty",
            "actual-duties",
            "_-actual-duties-table?beginDate=2026-03-01&sync=true",
            "_-actual-duties-table?beginDate=2026-04-01&sync=true",
            f"duty-details?beginDate=2026-03-21&allocatedEmployeeId={employee_id}",
            "_-json-confirm-allocation",
            "exchange-offers",
            "_-main-menu",
            "_-main-menu?sync=true",
        ]
        extra_results = {}
        for ep in extra_endpoints:
            result = fetch_endpoint(page, ep)
            body = result.get("body", "")
            print(f"  {result['status']} {ep}  ({len(body)} bytes)")
            if body and len(body) > 20:
                if "json" in result.get("content_type", ""):
                    print(f"    {body[:500]}")
                else:
                    titles = re.findall(r'title-text[^>]*>([^<]+)', body)
                    times_found = re.findall(r'(\d{2}:\d{2})', body)
                    data_attrs = re.findall(r'data-(\w+)="([^"]{1,50})"', body)
                    unique_attrs = {k for k, v in data_attrs}
                    if titles:
                        print(f"    Titles: {titles[:10]}")
                    if times_found:
                        print(f"    Times: {times_found[:10]}")
                    if unique_attrs:
                        print(f"    Data attrs: {sorted(unique_attrs)[:15]}")
            extra_results[ep] = {"status": result["status"], "body": body[:10000], "size": len(body)}

        save_json(out, "extra_endpoints.json", extra_results)

        # ─── Phase 6: Try pad-specific endpoints ───
        print(f"\n\n[7] Pad (IVU.pad mobile) endpoints ...")
        pad_endpoints = [
            "/mbweb/main/matter/pad/_-main-menu",
            "/mbweb/main/matter/pad/json-user",
            "/mbweb/main/matter/pad/duties",
            "/mbweb/main/matter/pad/dutyTimeTable",
            "/mbweb/main/matter/pad/schedule",
            "/mbweb/main/matter/pad/crew-on-trip",
            "/mbweb/main/matter/pad/crew-on-trip?sync=true",
            "/mbweb/main/matter/pad/actual-duty",
            "/mbweb/main/matter/pad/_-actual-duties-table?beginDate=2026-03-01",
            "/mbweb/main/matter/pad/_-actual-duties-table?beginDate=2026-03-01&sync=true",
            "/mbweb/main/matter/pad/messages",
            "/mbweb/main/matter/pad/timecard",
            "/mbweb/main/matter/pad/accounts-overview",
            "/mbweb/main/matter/pad/exchange-offers",
            "/mbweb/main/matter/pad/any-duty",
            "/mbweb/main/matter/pad/wish-request",
        ]
        pad_results = {}
        for ep in pad_endpoints:
            result = fetch_endpoint(page, ep)
            body = result.get("body", "")
            is_error = "Error" in body[:200] if body else False
            marker = "❌" if is_error else "✅"
            print(f"  {marker} {result['status']} {ep}  ({len(body)} bytes)")
            if body and not is_error:
                titles = re.findall(r'title-text[^>]*>([^<]+)', body)
                if titles:
                    print(f"    Content: {titles[:5]}")
                # Look for menu items, headers
                headers = re.findall(r'<h[1-6][^>]*>([^<]+)', body)
                if headers:
                    print(f"    Headers: {headers[:5]}")
                spans = re.findall(r'class="[^"]*(?:title|label|name)[^"]*"[^>]*>([^<]{2,60})', body)
                if spans:
                    print(f"    Labels: {list(set(spans))[:8]}")
            pad_results[ep] = {"status": result["status"], "body": body[:10000], "size": len(body), "is_error": is_error}

        save_json(out, "pad_endpoints.json", pad_results)

        print(f"\n{'='*60}")
        print("FEATURE DISCOVERY COMPLETE")
        print(f"Output: {out}")
        print(f"{'='*60}")

        browser.close()


if __name__ == "__main__":
    main()
