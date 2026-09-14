"""
Deep recon IVU.pad — po zalogowaniu czeka na sync, nawiguje do harmonogramu,
przechwytuje wszystkie API calls i dumpuje dane z CouchDB.

Użycie:
  python recon_deep.py --login <PORTAL_USER> --password <PORTAL_PASSWORD> --headed
"""

import argparse
import json
import time
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright, Page

PORTAL_BASE = "http://portal.intercity.pl"
COUCH_BASE = "/pad/admin/rest/couch-access"
OUTPUT_DIR = Path(__file__).parent / "recon_output"

api_calls: list[dict] = []


def setup_output():
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = OUTPUT_DIR / f"deep_{ts}"
    out.mkdir(parents=True, exist_ok=True)
    return out


def save_json(out: Path, name: str, data):
    with open(out / name, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    print(f"  💾 {name}")


def save_text(out: Path, name: str, text: str):
    with open(out / name, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"  💾 {name} ({len(text)} bytes)")


def on_response(response):
    url = response.url
    ct = response.headers.get("content-type", "")
    if response.request.resource_type not in ("xhr", "fetch"):
        return
    body = None
    if any(t in ct for t in ["json", "text"]):
        try:
            body = response.text()
        except Exception:
            pass
    api_calls.append({
        "method": response.request.method,
        "url": url,
        "status": response.status,
        "content_type": ct,
        "body": body,
        "timestamp": datetime.now().isoformat(),
    })


def login(page: Page, username: str, password: str) -> str | None:
    """Login and return JWT token. Try REST first, fallback to form."""
    print(f"\n[1] Trying REST login for '{username}' ...")

    # Method 1: Direct REST API login (no browser needed)
    try:
        resp = page.request.post(
            f"{PORTAL_BASE}/pad/admin/rest/login",
            data=json.dumps({"username": username, "password": password}),
            headers={"Content-Type": "application/json"},
            timeout=15000,
        )
        if resp.ok:
            data = resp.json()
            token = data.get("token")
            if token:
                print(f"[1] ✅ REST login success! Token: {len(token)} chars")
                print(f"    Modules: {data.get('unlockedModules', 'N/A')}")
                # Set cookie so browser requests also work
                page.context.add_cookies([{
                    "name": "IvuPadAuthToken",
                    "value": token,
                    "domain": "portal.intercity.pl",
                    "path": "/",
                }])
                # Navigate to main page with token
                page.goto(PORTAL_BASE, wait_until="networkidle", timeout=30000)
                time.sleep(3)
                return token
    except Exception as e:
        print(f"[1] REST login failed: {e}")

    # Method 2: Browser form login
    print("[1] Falling back to form login ...")
    page.goto(PORTAL_BASE, timeout=30000)
    time.sleep(3)

    # Wait for login form
    try:
        page.wait_for_selector('input[type="text"], input[type="password"]', timeout=15000)
    except Exception:
        print(f"[1] ❌ Login form not found. URL: {page.url}")
        print(f"    Title: {page.title()}")
        return None

    page.locator('input[type="text"]').first.fill(username)
    page.locator('input[type="password"]').first.fill(password)
    time.sleep(0.5)

    try:
        page.locator('button[type="submit"]').first.click()
    except Exception:
        page.locator('input[type="password"]').first.press("Enter")

    print("[2] Waiting for post-login load ...")
    time.sleep(8)
    try:
        page.wait_for_load_state("networkidle", timeout=20000)
    except Exception:
        pass

    cookies = page.context.cookies()
    token = next((c["value"] for c in cookies if c["name"] == "IvuPadAuthToken"), None)
    if token:
        print(f"[2] ✅ JWT token obtained ({len(token)} chars)")
    else:
        print("[2] ❌ No JWT token found!")
    return token


def wait_for_sync(page: Page, out: Path):
    """Wait for initial PouchDB sync to complete."""
    print("\n[3] Waiting for CouchDB sync to complete ...")

    for attempt in range(12):
        time.sleep(5)
        body = page.inner_text("body")
        if "pierwsza wizyta" in body.lower():
            print(f"  ⏳ Still syncing... (attempt {attempt+1}/12)")
        else:
            print(f"  ✅ Sync appears complete after {(attempt+1)*5}s")
            break

    page.screenshot(path=str(out / "after_sync.png"), full_page=True)
    save_text(out, "after_sync_body.txt", page.inner_text("body"))
    save_text(out, "after_sync_full.html", page.content())


def explore_navigation(page: Page, out: Path):
    """Click through IVU.pad navigation to find schedule/duty views."""
    print("\n[4] Exploring navigation ...")

    # Extract all clickable elements with text
    clickables = page.eval_on_selector_all(
        "button, a, [role='button'], [role='menuitem'], mat-list-item, .mat-list-item, .tile, [class*='tile'], [class*='menu'], [class*='nav']",
        """els => els.map(e => ({
            tag: e.tagName,
            text: (e.textContent || '').trim().substring(0, 100),
            class: e.className,
            href: e.href || null,
            visible: e.offsetParent !== null
        })).filter(e => e.visible && e.text.length > 0)"""
    )
    save_json(out, "clickable_elements.json", clickables)
    print(f"  Found {len(clickables)} clickable elements")

    # Print the interesting ones
    duty_keywords = ["harmon", "służb", "grafik", "dut", "schedule", "dienst",
                     "calendar", "kalend", "plan", "roster", "przypisani", "timetable"]
    for el in clickables:
        text_lower = el["text"].lower()
        for kw in duty_keywords:
            if kw in text_lower:
                print(f"  🎯 MATCH: '{el['text']}' ({el['tag']}, class={el['class'][:50]})")
                break


def navigate_to_schedule(page: Page, out: Path):
    """Try to open the schedule/duty timetable view."""
    print("\n[5] Navigating to schedule views ...")

    # Try clicking "Harmonogram służb" or similar
    schedule_selectors = [
        'text="Harmonogram służb"',
        'text="Przypisania służb"',
        ':text("Harmonogram")',
        ':text("Dienstplan")',
        ':text("Schedule")',
        ':text("Timetable")',
        ':text("Grafik")',
    ]

    for sel in schedule_selectors:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=2000):
                text = el.inner_text()
                print(f"  Clicking: '{text}' ...")

                api_calls.clear()
                el.click()
                time.sleep(8)
                page.wait_for_load_state("networkidle", timeout=20000)
                time.sleep(3)

                # Capture state after click
                slug = text.replace(" ", "_")[:30]
                page.screenshot(path=str(out / f"after_click_{slug}.png"), full_page=True)
                save_text(out, f"after_click_{slug}_body.txt", page.inner_text("body"))
                save_text(out, f"after_click_{slug}.html", page.content())

                # Save API calls triggered by this click
                if api_calls:
                    save_json(out, f"api_calls_after_{slug}.json", list(api_calls))
                    print(f"  📡 {len(api_calls)} API calls captured after clicking '{text}'")
                    for call in api_calls:
                        if "couch" in call["url"] or "mbweb" in call["url"]:
                            print(f"    {call['method']} {call['status']} {call['url'][:120]}")

                # Try to go back for next attempt
                page.go_back()
                time.sleep(3)
        except Exception as e:
            pass

    # Also try direct URL navigation
    direct_urls = [
        "/mbweb/main/matter/desktop/main-menu#duties",
        "/mbweb/main/matter/pad/main-menu#dutyTimeTable",
        "/mbweb/main/matter/pad/main-menu#schedule",
    ]

    for url in direct_urls:
        full = f"{PORTAL_BASE}{url}"
        print(f"\n  Direct nav: {url} ...")
        api_calls.clear()
        try:
            page.goto(full, timeout=20000)
            time.sleep(10)

            slug = url.split("#")[-1] if "#" in url else url.split("/")[-1]
            page.screenshot(path=str(out / f"direct_{slug}.png"), full_page=True)
            save_text(out, f"direct_{slug}_body.txt", page.inner_text("body"))
            save_text(out, f"direct_{slug}.html", page.content())

            if api_calls:
                save_json(out, f"api_calls_direct_{slug}.json", list(api_calls))
                print(f"  📡 {len(api_calls)} API calls captured")
                for call in api_calls:
                    if "couch" in call["url"] or "mbweb" in call["url"] or "timetable" in call["url"]:
                        print(f"    {call['method']} {call['status']} {call['url'][:120]}")
        except Exception as e:
            print(f"  Failed: {e}")


def dump_couch_databases(page: Page, out: Path, token: str):
    """Directly query CouchDB databases for actual data."""
    print("\n[6] Dumping CouchDB databases ...")

    databases = [
        "ivupad_timetable_assignments_<PORTAL_USER>",
        "ivupad_duty_nodes",
        "ivupad_node_statuses_<PORTAL_USER>",
        "ivupad_export_<PORTAL_USER>",
        "ivupad_nodes",
        "ivupad_users",
        "ivupad_config",
    ]

    headers = {"Cookie": f"IvuPadAuthToken={token}"}

    for db in databases:
        print(f"\n  📦 {db}")
        try:
            # DB info
            info_resp = page.request.get(
                f"{PORTAL_BASE}{COUCH_BASE}/{db}/",
                headers=headers, timeout=10000
            )
            info = info_resp.json()
            doc_count = info.get("doc_count", "?")
            print(f"    docs: {doc_count}, size: {info.get('sizes', {}).get('external', '?')} bytes")
            save_json(out, f"couch_{db}_info.json", info)

            # All docs with data
            docs_resp = page.request.get(
                f"{PORTAL_BASE}{COUCH_BASE}/{db}/_all_docs?include_docs=true",
                headers=headers, timeout=15000
            )
            docs = docs_resp.json()
            rows = docs.get("rows", [])

            # Filter out design docs for the data dump
            data_rows = [r for r in rows if not r.get("id", "").startswith("_design")]
            design_rows = [r for r in rows if r.get("id", "").startswith("_design")]

            print(f"    data docs: {len(data_rows)}, design docs: {len(design_rows)}")
            save_json(out, f"couch_{db}_all_docs.json", docs)

            if data_rows:
                print(f"    🎯 Found {len(data_rows)} data documents!")
                for row in data_rows[:5]:
                    doc = row.get("doc", {})
                    keys = [k for k in doc.keys() if not k.startswith("_")]
                    print(f"      id={row['id'][:40]}  keys={keys[:8]}")

        except Exception as e:
            print(f"    ❌ Error: {e}")

    # Try views that might return duty data
    print("\n  📦 Querying duty views ...")
    views_to_try = [
        f"{COUCH_BASE}/ivupad_timetable_assignments_<PORTAL_USER>/_design/userView/_view/by_departureTimestamp",
        f"{COUCH_BASE}/ivupad_duty_nodes/_design/globalView/_view/by_all?include_docs=true",
        f"{COUCH_BASE}/ivupad_nodes/_design/userView/_view/by_id_with_userGroups_and_users?include_docs=true",
    ]
    for view_path in views_to_try:
        try:
            resp = page.request.get(
                f"{PORTAL_BASE}{view_path}",
                headers=headers, timeout=10000
            )
            data = resp.json()
            slug = view_path.split("/")[-1].split("?")[0]
            db_name = view_path.split("/")[5] if len(view_path.split("/")) > 5 else "unknown"
            rows = data.get("rows", [])
            print(f"    {resp.status} {db_name}/{slug}: {len(rows)} rows")
            if rows:
                save_json(out, f"view_{db_name}_{slug}.json", data)
        except Exception as e:
            print(f"    ❌ {view_path}: {e}")


def probe_mbweb_endpoints(page: Page, out: Path):
    """Try mbweb backend endpoints that might have schedule data."""
    print("\n[7] Probing mbweb backend endpoints ...")

    endpoints = [
        "/mbweb/main/matter/desktop/json-user",
        "/mbweb/main/matter/desktop/sync",
        "/mbweb/main/exchange-service_v1_0",
        "/mbweb/main/messages-service_v1_0",
        "/mbweb/main/matter/pad/ivu-pad-api",
        "/mbweb/main/matter/pad/ivu-pad-api/duties",
        "/mbweb/main/matter/pad/ivu-pad-api/schedule",
        "/mbweb/main/matter/pad/ivu-pad-api/timetable",
        "/mbweb/main/matter/pad/ivu-pad-api/calendar",
        "/mbweb/main/matter/pad/ivu-pad-api/user",
        "/mbweb/main/matter/pad/ivu-pad-api/config",
        "/mbweb/main/matter/pad/ivu-pad-api/employee",
        "/mbweb/main/matter/pad/ivu-pad-api/duty-assignments",
        "/mbweb/main/matter/pad/duty-timetable",
        "/mbweb/main/matter/pad/duty-assignments",
        "/mbweb/manifest.json",
    ]

    results = {}
    for ep in endpoints:
        try:
            resp = page.request.get(f"{PORTAL_BASE}{ep}", timeout=10000)
            ct = resp.headers.get("content-type", "")
            body = ""
            if any(t in ct for t in ["json", "text", "html"]):
                try:
                    body = resp.text()[:5000]
                except Exception:
                    pass

            marker = "✅" if 200 <= resp.status < 400 else "❌"
            has_json = "json" in ct
            print(f"  {marker} {resp.status} {ep}  [{ct[:40]}]{'  📊 JSON!' if has_json else ''}")
            results[ep] = {
                "status": resp.status,
                "content_type": ct,
                "body_preview": body[:2000],
                "body_full": body,
            }

            if has_json and body:
                try:
                    parsed = json.loads(body)
                    if isinstance(parsed, dict):
                        keys = list(parsed.keys())[:10]
                        print(f"         keys: {keys}")
                except Exception:
                    pass
        except Exception as e:
            print(f"  ⏱️  {ep}: {e}")
            results[ep] = {"error": str(e)}

    save_json(out, "mbweb_endpoints.json", results)


def main():
    parser = argparse.ArgumentParser(description="Deep IVU.pad Recon")
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
        page.on("response", on_response)

        # Phase 1: Login
        token = login(page, args.login, args.password)
        if not token:
            page.screenshot(path=str(out / "login_failed.png"))
            browser.close()
            return

        # Phase 2: Wait for sync
        wait_for_sync(page, out)

        # Phase 3: Explore navigation
        explore_navigation(page, out)

        # Phase 4: Navigate to schedule
        navigate_to_schedule(page, out)

        # Phase 5: Dump CouchDB
        dump_couch_databases(page, out, token)

        # Phase 6: Probe mbweb
        probe_mbweb_endpoints(page, out)

        # Save all captured API calls
        save_json(out, "all_api_calls.json", api_calls)

        # Summary
        print("\n" + "=" * 60)
        print("DEEP RECON SUMMARY")
        print("=" * 60)
        couch_calls = [c for c in api_calls if "couch" in c["url"]]
        mbweb_calls = [c for c in api_calls if "mbweb" in c["url"]]
        print(f"Total API calls:   {len(api_calls)}")
        print(f"CouchDB calls:     {len(couch_calls)}")
        print(f"mbweb calls:       {len(mbweb_calls)}")
        print(f"Output:            {out}")
        print("=" * 60)

        browser.close()


if __name__ == "__main__":
    main()
