"""
Skrypt zwiadowczy IVU.pad (portal.intercity.pl)
Przechwytuje: login flow, API calls, DOM structure, cookies, headers.
Wynik: folder recon_output/ z pełnym dumpem.

Użycie:
  pip install playwright
  playwright install chromium
  python recon_portal.py --login TWOJ_LOGIN --password TWOJE_HASLO
"""

import argparse
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright, Page, BrowserContext

PORTAL_BASE = "http://portal.intercity.pl"
OUTPUT_DIR = Path(__file__).parent / "recon_output"

captured_requests: list[dict] = []
captured_responses: list[dict] = []


def setup_output():
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = OUTPUT_DIR / ts
    out.mkdir(parents=True, exist_ok=True)
    return out


def on_request(request):
    captured_requests.append({
        "url": request.url,
        "method": request.method,
        "headers": dict(request.headers),
        "post_data": request.post_data,
        "resource_type": request.resource_type,
        "timestamp": datetime.now().isoformat(),
    })


def on_response(response):
    body = None
    content_type = response.headers.get("content-type", "")
    if any(t in content_type for t in ["json", "text", "html", "xml", "javascript"]):
        try:
            body = response.text()
        except Exception:
            body = "<binary or failed to read>"

    captured_responses.append({
        "url": response.url,
        "status": response.status,
        "headers": dict(response.headers),
        "content_type": content_type,
        "body_preview": body[:5000] if body else None,
        "body_full": body,
        "timestamp": datetime.now().isoformat(),
    })


def save_json(out: Path, name: str, data):
    path = out / name
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    print(f"  Saved {path.name} ({len(json.dumps(data, default=str))} bytes)")


def save_text(out: Path, name: str, text: str):
    path = out / name
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"  Saved {path.name} ({len(text)} bytes)")


def do_login(page: Page, login: str, password: str) -> bool:
    print(f"\n[1] Navigating to {PORTAL_BASE} ...")
    page.goto(PORTAL_BASE, wait_until="networkidle", timeout=30000)
    time.sleep(2)

    print(f"[2] Current URL: {page.url}")
    print(f"[2] Title: {page.title()}")

    # Look for login form
    username_selectors = [
        'input[name="username"]', 'input[name="j_username"]',
        'input[name="user"]', 'input[type="text"]',
        '#username', '#j_username', '#user',
        'input[placeholder*="user" i]', 'input[placeholder*="login" i]',
        'input[autocomplete="username"]',
    ]
    password_selectors = [
        'input[name="password"]', 'input[name="j_password"]',
        'input[type="password"]', '#password', '#j_password',
    ]
    submit_selectors = [
        'button[type="submit"]', 'input[type="submit"]',
        'button:has-text("Login")', 'button:has-text("Zaloguj")',
        'button:has-text("Sign in")', '.login-button', '#loginButton',
    ]

    username_input = None
    for sel in username_selectors:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=1000):
                username_input = el
                print(f"[3] Found username input: {sel}")
                break
        except Exception:
            continue

    password_input = None
    for sel in password_selectors:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=1000):
                password_input = el
                print(f"[3] Found password input: {sel}")
                break
        except Exception:
            continue

    if not username_input or not password_input:
        print("[!] Could not find login form inputs!")
        return False

    print(f"[4] Filling credentials for '{login}' ...")
    username_input.fill(login)
    password_input.fill(password)
    time.sleep(0.5)

    # Find and click submit
    for sel in submit_selectors:
        try:
            btn = page.locator(sel).first
            if btn.is_visible(timeout=1000):
                print(f"[4] Clicking submit: {sel}")
                btn.click()
                break
        except Exception:
            continue
    else:
        print("[4] No submit button found, pressing Enter ...")
        password_input.press("Enter")

    print("[5] Waiting for navigation after login ...")
    time.sleep(5)
    page.wait_for_load_state("networkidle", timeout=20000)
    time.sleep(3)

    print(f"[5] Post-login URL: {page.url}")
    print(f"[5] Post-login title: {page.title()}")

    return True


def explore_api_endpoints(page: Page, out: Path):
    """Try known IVU.pad API endpoints."""
    print("\n[6] Probing known IVU.pad API endpoints ...")

    known_endpoints = [
        "/pad/admin/rest/files",
        "/pad/admin/rest/config",
        "/pad/admin/rest/info",
        "/pad/admin/rest/version",
        "/pad/admin/rest/user",
        "/pad/admin/rest/user/current",
        "/pad/api",
        "/pad/api/v1",
        "/pad/rest",
        "/mbweb/main/matter/pad/ivu-pad-api",
        "/mbweb/main/matter/pad/ivu-pad-api/duties",
        "/mbweb/main/matter/pad/ivu-pad-api/schedule",
        "/mbweb/main/matter/pad/ivu-pad-api/calendar",
        "/mbweb/main/matter/pad/ivu-pad-api/user",
        "/mbweb/main/matter/pad/ivu-pad-api/config",
        "/mbweb/main/matter/desktop/main-menu",
        "/mbweb/main/matter/desktop/main-menu#duties",
        "/mbweb/api",
        "/mbweb/rest",
        "/api",
        "/api/v1",
        "/api/duties",
        "/api/schedule",
    ]

    results = {}
    for endpoint in known_endpoints:
        url = f"{PORTAL_BASE}{endpoint}"
        try:
            resp = page.request.get(url, timeout=8000)
            body = ""
            ct = resp.headers.get("content-type", "")
            if any(t in ct for t in ["json", "text", "html", "xml"]):
                try:
                    body = resp.text()[:3000]
                except Exception:
                    body = "<failed to read>"

            status = resp.status
            marker = "✅" if 200 <= status < 400 else "❌"
            print(f"  {marker} {status} {endpoint}  [{ct[:40]}]")
            results[endpoint] = {
                "status": status,
                "content_type": ct,
                "body_preview": body,
                "headers": dict(resp.headers),
            }
        except Exception as e:
            print(f"  ⏱️ TIMEOUT {endpoint}: {e}")
            results[endpoint] = {"status": "timeout", "error": str(e)}

    save_json(out, "api_probe_results.json", results)


def explore_dom(page: Page, out: Path):
    """Dump page structure after login."""
    print("\n[7] Dumping DOM structure ...")

    html = page.content()
    save_text(out, "page_full.html", html)

    body_text = page.inner_text("body")
    save_text(out, "page_body_text.txt", body_text)

    # Extract all links
    links = page.eval_on_selector_all("a[href]", "els => els.map(e => ({href: e.href, text: e.textContent.trim()}))")
    save_json(out, "page_links.json", links)

    # Extract all forms
    forms = page.eval_on_selector_all("form", """els => els.map(f => ({
        action: f.action, method: f.method, id: f.id, className: f.className,
        inputs: Array.from(f.querySelectorAll('input,select,textarea')).map(i => ({
            type: i.type, name: i.name, id: i.id, placeholder: i.placeholder, value: i.value
        }))
    }))""")
    save_json(out, "page_forms.json", forms)

    # Extract all iframes
    iframes = page.eval_on_selector_all("iframe", "els => els.map(e => ({src: e.src, id: e.id, name: e.name}))")
    save_json(out, "page_iframes.json", iframes)

    # Navigation / menu items
    nav_items = page.eval_on_selector_all(
        "nav a, .menu a, [role='menu'] a, [role='menuitem'], .nav-item, .sidebar a, button[class*='menu'], button[class*='nav']",
        "els => els.map(e => ({tag: e.tagName, text: e.textContent.trim(), href: e.href || null, class: e.className}))"
    )
    save_json(out, "page_nav_items.json", nav_items)

    page.screenshot(path=str(out / "screenshot_post_login.png"), full_page=True)
    print("  Screenshot saved.")


def navigate_to_duties(page: Page, out: Path):
    """Try to navigate to the duties/schedule view."""
    print("\n[8] Looking for duties/schedule view ...")

    duty_keywords = ["dut", "schedule", "grafik", "calendar", "kalend", "dienst", "roster", "shift"]
    body_text = page.inner_text("body").lower()

    for kw in duty_keywords:
        if kw in body_text:
            print(f"  Found keyword '{kw}' in page text")

    # Try clicking navigation elements that might lead to duties
    nav_selectors = [
        'a:has-text("Duties")', 'a:has-text("Schedule")',
        'a:has-text("Grafik")', 'a:has-text("Kalendarz")',
        'a:has-text("Dienst")', 'a:has-text("Roster")',
        '[href*="dut"]', '[href*="schedule"]', '[href*="calendar"]',
        '[href*="grafik"]', '[href*="roster"]',
    ]

    for sel in nav_selectors:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=1000):
                text = el.inner_text()
                href = el.get_attribute("href") or "no href"
                print(f"  Found nav element: '{text}' -> {href}")
        except Exception:
            continue

    # Try direct navigation to duties URL (old Irena path)
    duty_urls = [
        f"{PORTAL_BASE}/mbweb/main/matter/desktop/main-menu#duties",
        f"{PORTAL_BASE}/pad/duties",
        f"{PORTAL_BASE}/pad/schedule",
    ]

    for url in duty_urls:
        try:
            print(f"\n  Navigating to {url} ...")
            page.goto(url, wait_until="networkidle", timeout=15000)
            time.sleep(5)
            print(f"  Result URL: {page.url}")
            print(f"  Title: {page.title()}")

            html = page.content()
            slug = re.sub(r'[^a-z0-9]', '_', url.split("//")[1])[:60]
            save_text(out, f"duties_{slug}.html", html)
            page.screenshot(path=str(out / f"screenshot_{slug}.png"), full_page=True)

            body = page.inner_text("body")
            save_text(out, f"duties_{slug}_text.txt", body)
        except Exception as e:
            print(f"  Failed: {e}")


def main():
    parser = argparse.ArgumentParser(description="IVU.pad Portal Recon")
    parser.add_argument("--login", required=True, help="Portal username")
    parser.add_argument("--password", required=True, help="Portal password")
    parser.add_argument("--headed", action="store_true", help="Run with visible browser")
    args = parser.parse_args()

    out = setup_output()
    print(f"Output directory: {out}")

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

        page.on("request", on_request)
        page.on("response", on_response)

        # Phase 1: Login
        logged_in = do_login(page, args.login, args.password)
        if not logged_in:
            print("\n[!] Login failed, saving what we have ...")
            html = page.content()
            save_text(out, "login_page.html", html)
            page.screenshot(path=str(out / "screenshot_login_fail.png"), full_page=True)
        else:
            # Phase 2: Explore DOM
            explore_dom(page, out)

            # Phase 3: Probe API endpoints
            explore_api_endpoints(page, out)

            # Phase 4: Navigate to duties
            navigate_to_duties(page, out)

        # Save all captured network traffic
        save_json(out, "network_requests.json", captured_requests)
        save_json(out, "network_responses.json", captured_responses)

        # Save cookies
        cookies = context.cookies()
        save_json(out, "cookies.json", cookies)

        # Summary
        print("\n" + "=" * 60)
        print("RECON SUMMARY")
        print("=" * 60)
        print(f"Total requests captured:  {len(captured_requests)}")
        print(f"Total responses captured: {len(captured_responses)}")

        api_calls = [r for r in captured_requests if r["resource_type"] in ("xhr", "fetch")]
        print(f"XHR/Fetch API calls:      {len(api_calls)}")

        if api_calls:
            print("\nAPI calls found:")
            for call in api_calls:
                print(f"  {call['method']} {call['url'][:100]}")

        json_responses = [r for r in captured_responses if "json" in r.get("content_type", "")]
        print(f"\nJSON responses:           {len(json_responses)}")
        for jr in json_responses:
            print(f"  {jr['status']} {jr['url'][:100]}")

        print(f"\nOutput saved to: {out}")
        print("=" * 60)

        browser.close()


if __name__ == "__main__":
    main()
