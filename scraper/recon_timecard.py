"""
Targeted reconnaissance: duty-details breakdown + timecard confirmation mechanism.

Grabs full HTML of duty-details for days with real duties,
intercepts network requests to understand confirm-allocation flow,
and probes actual-duties for allocation IDs.

Usage:
  python recon_timecard.py --login idutkiewicz --password Marzec2026
"""

import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright, Page

PORTAL = "http://portal.intercity.pl"
OUTPUT_DIR = Path(__file__).parent / "recon_output"


def setup_output():
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = OUTPUT_DIR / f"timecard_{ts}"
    out.mkdir(parents=True, exist_ok=True)
    return out


def save(out, name, content):
    with open(out / name, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  saved {name} ({len(content)} bytes)")


def save_json(out, name, data):
    with open(out / name, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    print(f"  saved {name}")


def do_login(page: Page, username: str, password: str) -> bool:
    # Attempt 1: REST API login
    try:
        resp = page.request.post(
            f"{PORTAL}/pad/admin/rest/login",
            data=json.dumps({"user": username, "password": password}),
            headers={"Content-Type": "application/json"},
            timeout=15000,
        )
        if resp.status == 200:
            data = resp.json()
            token = data.get("token") or data.get("authToken")
            if token:
                page.context.add_cookies([{
                    "name": "IvuPadAuthToken",
                    "value": token,
                    "domain": "portal.intercity.pl",
                    "path": "/",
                }])
                page.goto(PORTAL, timeout=30000)
                time.sleep(5)
                print("  (REST API login)")
                return True
    except Exception as e:
        print(f"  REST login failed: {e}")

    # Attempt 2: form-based login
    page.goto(PORTAL, timeout=30000)
    time.sleep(5)
    try:
        page.wait_for_selector('input[type="text"], input[type="password"]', timeout=20000)
    except Exception:
        print(f"  No login form found at {page.url}")
        page.screenshot(path=str(Path(__file__).parent / "recon_output" / "login_debug.png"))
        return False
    page.locator('input[type="text"]').first.fill(username)
    page.locator('input[type="password"]').first.fill(password)
    time.sleep(1)
    try:
        page.locator('button[type="submit"]').first.click()
    except Exception:
        page.locator('input[type="password"]').first.press("Enter")
    time.sleep(10)
    try:
        page.wait_for_load_state("networkidle", timeout=25000)
    except Exception:
        pass
    for _ in range(6):
        try:
            if "pierwsza wizyta" in page.inner_text("body").lower():
                time.sleep(5)
            else:
                break
        except Exception:
            break
    cookies = page.context.cookies()
    return any(c["name"] == "IvuPadAuthToken" for c in cookies)


def fetch(page: Page, path: str) -> dict:
    url = f"{PORTAL}/mbweb/main/matter/desktop/{path}" if not path.startswith("/") else f"{PORTAL}{path}"
    try:
        resp = page.request.get(url, timeout=15000)
        body = ""
        ct = resp.headers.get("content-type", "")
        if any(t in ct for t in ["json", "text", "html", "xml"]):
            body = resp.text()
        return {"status": resp.status, "content_type": ct, "body": body, "url": url}
    except Exception as e:
        return {"status": "error", "error": str(e), "url": url}


def parse_duty_elements(html: str) -> list[dict]:
    """Extract structured duty elements from duty-details HTML."""
    elements = []

    blocks = re.split(r'<(?:div|tr|li)[^>]*class="[^"]*(?:element|activity|row|block|entry|item)[^"]*"', html)

    time_pairs = re.findall(
        r'(?:Beginn|Start|Von|von|begin|start)[:\s]*(\d{2}:\d{2}).*?'
        r'(?:Ende|End|Bis|bis|end)[:\s]*(\d{2}:\d{2})',
        html, re.DOTALL
    )
    for start, end in time_pairs:
        elements.append({"start": start, "end": end})

    all_times = re.findall(r'(\d{2}:\d{2})', html)
    all_classes = re.findall(r'class="([^"]*)"', html)
    data_attrs = re.findall(r'(data-[\w-]+)="([^"]*)"', html)

    return {
        "parsed_time_pairs": [{"start": s, "end": e} for s, e in time_pairs],
        "all_times": all_times,
        "unique_classes": sorted(set(all_classes))[:50],
        "data_attributes": {k: v for k, v in data_attrs},
        "element_block_count": len(blocks) - 1,
    }


def parse_actual_duties(html: str) -> list[dict]:
    """Extract allocation IDs and duty info from actual-duties table."""
    duties = []
    rows = re.findall(
        r'<(?:td|div|li)[^>]*data-allocationid="(\d+)"[^>]*data-date="([^"]*)"[^>]*'
        r'(?:data-url="([^"]*)")?[^>]*>(.*?)</(?:td|div|li)>',
        html, re.DOTALL
    )
    for alloc_id, date, url, content in rows:
        title = re.search(r'title-text[^>]*>([^<]+)', content)
        times = re.findall(r'(\d{2}:\d{2})', content)
        duties.append({
            "allocation_id": alloc_id,
            "date": date,
            "url": url,
            "title": title.group(1).strip() if title else None,
            "times": times,
        })

    if not duties:
        alloc_ids = re.findall(r'data-allocationid="(\d+)"', html)
        dates = re.findall(r'data-date="(\d{4}-\d{2}-\d{2})"', html)
        urls = re.findall(r'data-url="([^"]*)"', html)
        titles = re.findall(r'title-text[^>]*>([^<]+)', html)
        for i, aid in enumerate(alloc_ids):
            duties.append({
                "allocation_id": aid,
                "date": dates[i] if i < len(dates) else None,
                "url": urls[i] if i < len(urls) else None,
                "title": titles[i].strip() if i < len(titles) else None,
            })

    return duties


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
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        )
        page = context.new_page()

        print("[1] Logging in ...")
        if not do_login(page, args.login, args.password):
            print("Login failed!")
            browser.close()
            return
        print("  OK\n")

        # === Phase 1: Duty details for days with known duties ===
        print("[2] Fetching duty-details for days with real duties ...")
        duty_days = [
            "2026-03-01",  # KWR212
            "2026-03-06",  # had Beginn 07:00 Ende 17:18
            "2026-03-08",
            "2026-03-10",
            "2026-03-15",
            "2026-03-20",
        ]
        all_duty_details = {}
        for date in duty_days:
            path = f"duty-details?beginDate={date}&sync=true"
            print(f"\n  {date}:")
            result = fetch(page, path)
            body = result.get("body", "")
            save(out, f"duty_details_{date}.html", body)

            if body and result["status"] == 200:
                parsed = parse_duty_elements(body)
                all_duty_details[date] = {
                    "status": result["status"],
                    "body_size": len(body),
                    "parsed": parsed,
                }
                print(f"    Times: {parsed['all_times'][:12]}")
                print(f"    Time pairs (start/end): {parsed['parsed_time_pairs']}")
                print(f"    Data attrs: {list(parsed['data_attributes'].keys())[:15]}")
                print(f"    Classes: {[c for c in parsed['unique_classes'] if 'duty' in c or 'time' in c or 'element' in c or 'alloc' in c or 'detail' in c][:15]}")
            else:
                all_duty_details[date] = {"status": result["status"], "body_size": len(body)}
                text = re.sub(r'<[^>]+>', ' ', body)
                text = re.sub(r'\s+', ' ', text).strip()
                print(f"    {text[:200]}")

        save_json(out, "duty_details_parsed.json", all_duty_details)

        # === Phase 2: Actual duties with allocation IDs ===
        print("\n\n[3] Fetching actual-duties table for March ...")
        result = fetch(page, "_-actual-duties-table?beginDate=2026-03-01&sync=true")
        body = result.get("body", "")
        save(out, "actual_duties_march.html", body)

        duties = parse_actual_duties(body)
        print(f"  Found {len(duties)} duty allocations:")
        for d in duties[:15]:
            print(f"    {d['date']} | ID={d['allocation_id']} | {d.get('title', '?')} | url={d.get('url', '?')}")

        save_json(out, "actual_duties_allocations.json", duties)

        # === Phase 3: For each allocation, try to get its detail ===
        if duties:
            print(f"\n\n[4] Fetching detail for first 5 allocations ...")
            for d in duties[:5]:
                if d.get("url"):
                    print(f"\n  Allocation {d['allocation_id']} ({d.get('title', '?')}):")
                    result = fetch(page, d["url"] + "&sync=true")
                    body = result.get("body", "")
                    save(out, f"alloc_detail_{d['allocation_id']}.html", body)
                    if body:
                        parsed = parse_duty_elements(body)
                        print(f"    Times: {parsed['all_times'][:12]}")
                        print(f"    Pairs: {parsed['parsed_time_pairs']}")
                        data = parsed['data_attributes']
                        interesting = {k: v for k, v in data.items() if any(x in k for x in ['alloc', 'confirm', 'submit', 'edit', 'status', 'id'])}
                        if interesting:
                            print(f"    Key data attrs: {interesting}")

        # === Phase 4: Probe confirm-allocation with POST ===
        print("\n\n[5] Probing _-json-confirm-allocation (POST) ...")
        confirm_url = f"{PORTAL}/mbweb/main/matter/desktop/_-json-confirm-allocation"

        test_payloads = [
            {},
            {"allocationId": duties[0]["allocation_id"]} if duties else {},
            {"id": duties[0]["allocation_id"]} if duties else {},
        ]
        for payload in test_payloads:
            if not payload:
                continue
            try:
                resp = page.request.post(confirm_url, data=json.dumps(payload),
                    headers={"Content-Type": "application/json"}, timeout=10000)
                print(f"  POST {payload} -> {resp.status}: {resp.text()[:500]}")
            except Exception as e:
                print(f"  POST {payload} -> error: {e}")

        if duties:
            try:
                resp = page.request.post(confirm_url,
                    form={"allocationId": duties[0]["allocation_id"]}, timeout=10000)
                print(f"  POST form allocationId={duties[0]['allocation_id']} -> {resp.status}: {resp.text()[:500]}")
            except Exception as e:
                print(f"  POST form -> error: {e}")

        # === Phase 5: Check what JS files reference about confirm ===
        print("\n\n[6] Checking JS for confirm/timecard logic ...")
        js_urls = [
            "/mbweb/static/matter/desktop/js/duties.min.js",
            "/mbweb/static/matter/desktop/js/duties.js",
            "/mbweb/static/matter/desktop/js/actual-duties.min.js",
            "/mbweb/static/matter/desktop/js/actual-duties.js",
            "/mbweb/static/matter/desktop/js/allocation-details.min.js",
            "/mbweb/static/matter/desktop/js/allocation-details.js",
            "/mbweb/static/matter/pad/js/duties.min.js",
            "/mbweb/static/matter/pad/js/duties.js",
        ]
        for js_url in js_urls:
            try:
                resp = page.request.get(f"{PORTAL}{js_url}", timeout=8000)
                if resp.status == 200:
                    js_body = resp.text()
                    print(f"\n  {js_url} ({len(js_body)} bytes)")
                    save(out, js_url.replace("/", "_").strip("_") + ".js", js_body)

                    confirms = re.findall(r'["\']([^"\']*confirm[^"\']*)["\']', js_body, re.I)
                    submits = re.findall(r'["\']([^"\']*submit[^"\']*)["\']', js_body, re.I)
                    posts = re.findall(r'\.(post|ajax|fetch)\s*\(([^)]{1,200})', js_body)
                    alloc_refs = re.findall(r'["\']([^"\']*alloc[^"\']*)["\']', js_body, re.I)

                    if confirms:
                        print(f"    confirm refs: {list(set(confirms))[:10]}")
                    if submits:
                        print(f"    submit refs: {list(set(submits))[:10]}")
                    if posts:
                        print(f"    POST/ajax calls: {posts[:5]}")
                    if alloc_refs:
                        print(f"    allocation refs: {list(set(alloc_refs))[:10]}")
            except Exception:
                pass

        print(f"\n{'='*60}")
        print("TIMECARD RECON COMPLETE")
        print(f"Output: {out}")
        print(f"{'='*60}")

        browser.close()


if __name__ == "__main__":
    main()
