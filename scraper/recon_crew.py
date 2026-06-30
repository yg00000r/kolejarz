"""
Reconnaissance: Crew on Trip (Besatzung / załoga pociągu).

Bada endpoint `_-crew-on-trip-table`, który ładuje skład drużyny pociągowej
(kierownik, konduktorzy, maszynista) wraz z odcinkami dla danej daty i numeru pociągu.

Formularz `/mbweb/main/matter/pad/crew-on-trip` zawiera:
  - input name="date"        (ukryty, format dd.mm.yy z datepickera)
  - input name="tripNumber"  (numer pociągu, np. 6200)
  - data-url="_-crew-on-trip-table"  (endpoint wyników)

Strategia:
  1. Próba bezpośredniego GET na `_-crew-on-trip-table` (pad + desktop, różne formaty daty)
     — sprawdzamy czy da się ominąć Akamai przez sesyjne cookies przeglądarki.
  2. Fallback: automatyzacja UI — wypełnienie formularza, klik Szukaj,
     przechwycenie odpowiedzi sieciowej + DOM #trip-content-target.

Zapisuje surowy HTML do recon_output/crew_YYYYMMDD_HHMMSS/.

Użycie:
  python recon_crew.py --login idutkiewicz --password 'haslo' --date 2026-06-20 --trip 6200
  python recon_crew.py --login idutkiewicz --password 'haslo' --date 2026-06-20 --trip 6200 --headed
"""

import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright, Page

PORTAL = "http://portal.intercity.pl"
PAD = "/mbweb/main/matter/pad"
DESKTOP = "/mbweb/main/matter/desktop"
OUTPUT_DIR = Path(__file__).parent / "recon_output"


def setup_output():
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = OUTPUT_DIR / f"crew_{ts}"
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


def date_variants(iso_date: str) -> list[str]:
    """Generuje warianty formatu daty dla portalu (ISO, dd.mm.yy, dd.mm.yyyy)."""
    try:
        d = datetime.strptime(iso_date, "%Y-%m-%d")
    except ValueError:
        return [iso_date]
    return [
        iso_date,                       # 2026-06-20
        d.strftime("%d.%m.%y"),         # 20.06.26  (dateFormatPattern dd.mm.yy)
        d.strftime("%d.%m.%Y"),         # 20.06.2026
    ]


def classify(body: str, status) -> tuple[str, dict]:
    """Klasyfikuje odpowiedź: BLOCK (Akamai), ERR (error page IVU),
    NULL (text is null — zły param), EMPTY (pusta tabela), DATA (są wyniki)."""
    is_denied = "Access Denied" in body[:300] or status == 403
    is_errpage = "IVU.plan Portal - Error" in body[:600]
    is_null = "text is null" in body or "ein Fehler bei Ihrer Anfrage" in body or 'id="error-view"' in body
    has_data = any(k in body for k in ("trip-component", "crew", "Besatzung", "duty-components",
                                       "title-text", "allocation", "employee", "person"))
    if is_denied:
        marker = "BLOCK"
    elif is_errpage:
        marker = "ERRPAGE"
    elif is_null:
        marker = "NULL"
    elif has_data and len(body) > 1000:
        marker = "DATA"
    else:
        marker = "EMPTY"
    return marker, {"denied": is_denied, "error_page": is_errpage, "null_error": is_null, "has_data": has_data}


def try_direct(page: Page, iso_date: str, trip: str) -> dict:
    """Próba bezpośredniego GET/POST na _-crew-on-trip-table.

    Testuje warianty nazw parametrów (beginDate vs date, tripNumber vs trainNumber)
    bo błąd 'text is null' sugeruje złą nazwę. Reszta portalu używa beginDate.
    """
    results = {}
    base = f"{PORTAL}{PAD}/_-crew-on-trip-table"
    # Nazwy parametru daty (beginDate jak reszta portalu, date jak form hidden input)
    date_keys = ["beginDate", "date"]
    trip_keys = ["tripNumber", "trainNumber", "tripNo", "fahrtNummer"]

    def probe(method: str, url: str, data=None):
        try:
            if method == "GET":
                resp = page.request.get(url, timeout=15000)
            else:
                resp = page.request.post(url, form=data, timeout=15000)
            body = ""
            ct = resp.headers.get("content-type", "")
            if any(t in ct for t in ["json", "text", "html", "xml"]):
                body = resp.text()
            marker, flags = classify(body, resp.status)
            label = f"{method} {url}" + (f" [{data}]" if data else "")
            print(f"  [{marker}] {resp.status} {label}  ({len(body)} b)")
            results[label] = {"status": resp.status, "content_type": ct, "marker": marker,
                              **flags, "body_size": len(body), "body": body[:20000]}
            return marker
        except Exception as e:
            print(f"  [EXC] {method} {url}: {e}")
            results[f"{method} {url}"] = {"status": "error", "error": str(e)}
            return "EXC"

    # GET: kombinacje nazw param + formatów daty (beginDate najpierw — najbardziej prawdopodobne)
    for dkey in date_keys:
        for tkey in trip_keys:
            for dval in date_variants(iso_date):
                qs = f"?{dkey}={dval}&{tkey}={trip}&sync=true"
                probe("GET", base + qs)

    # POST: form-encoded (jak _-json-confirm-allocation)
    for dval in date_variants(iso_date)[:2]:
        probe("POST", f"{base}?sync=true", data={"beginDate": dval, "tripNumber": trip})
        probe("POST", f"{base}?sync=true", data={"date": dval, "tripNumber": trip})

    return results


def try_ui(page: Page, out: Path, iso_date: str, trip: str) -> dict:
    """Automatyzacja UI: wypełnia formularz crew-on-trip i przechwytuje wynik."""
    captured = {"network": [], "dom": None, "navigated": False}

    def on_request(req):
        if "crew-on-trip-table" in req.url:
            try:
                post = req.post_data
            except Exception:
                post = None
            captured["network"].append({
                "phase": "request",
                "url": req.url,
                "method": req.method,
                "post_data": post,
            })

    def on_response(resp):
        if "crew-on-trip-table" in resp.url or "crew-on-trip" in resp.url:
            try:
                body = resp.text()
            except Exception:
                body = ""
            captured["network"].append({
                "phase": "response",
                "url": resp.url,
                "status": resp.status,
                "content_type": resp.headers.get("content-type", ""),
                "body_size": len(body),
                "body": body[:20000],
            })

    page.on("request", on_request)
    page.on("response", on_response)

    # Nawigacja do crew-on-trip (SPA — przez hash route)
    nav_urls = [
        f"{PORTAL}{PAD}/crew-on-trip",
        f"{PORTAL}{DESKTOP}/#crew-on-trip",
        f"{PORTAL}{PAD}/#crew-on-trip",
    ]
    for nav in nav_urls:
        try:
            page.goto(nav, timeout=30000)
            time.sleep(4)
            if page.locator('input[name="tripNumber"], #tripnumber-input').count() > 0:
                captured["navigated"] = True
                print(f"  UI: formularz znaleziony przy {nav}")
                break
        except Exception as e:
            print(f"  UI nav {nav} failed: {e}")

    if not captured["navigated"]:
        # Spróbuj kliknąć w menu pozycję crew-on-trip
        try:
            page.goto(f"{PORTAL}{PAD}/duties", timeout=30000)
            time.sleep(4)
            item = page.locator('[data-activeentry="item--crew-on-trip"], a[href*="crew-on-trip"], li:has-text("Besatzung"), li:has-text("Załoga")')
            if item.count() > 0:
                item.first.click()
                time.sleep(4)
                captured["navigated"] = page.locator('input[name="tripNumber"], #tripnumber-input').count() > 0
        except Exception as e:
            print(f"  UI menu fallback failed: {e}")

    if not captured["navigated"]:
        print("  UI: nie udało się otworzyć formularza crew-on-trip")
        return captured

    # Zapisz HTML formularza
    try:
        save(out, "form_page.html", page.content())
    except Exception:
        pass

    # Ustaw datę przez jQuery datepicker API (właściwy kanał — trigger change + onSelect)
    dd_mm_yy = datetime.strptime(iso_date, "%Y-%m-%d").strftime("%d.%m.%y")
    try:
        page.evaluate(
            """({iso, dmy}) => {
                const alt = document.querySelector('#datepicker-alt, input[name="date"]');
                const vis = document.querySelector('#datepicker');
                const btn = document.querySelector('#search-button');
                // Ustaw oba formaty + odpal zdarzenia change
                if (alt) { alt.value = iso; alt.dispatchEvent(new Event('change', {bubbles:true})); }
                if (vis) { vis.value = dmy; vis.dispatchEvent(new Event('change', {bubbles:true})); }
                if (btn) { btn.setAttribute('data-date', iso); }
                // jQuery UI datepicker setDate, jeśli dostępny
                try {
                    if (window.jQuery && jQuery('#datepicker').datepicker) {
                        jQuery('#datepicker').datepicker('setDate', new Date(iso));
                    }
                } catch (e) {}
            }""",
            {"iso": iso_date, "dmy": dd_mm_yy},
        )
        page.fill('input[name="tripNumber"], #tripnumber-input', str(trip))
        time.sleep(0.5)
        print(f"  UI: wypełniono date={iso_date} ({dd_mm_yy}) trip={trip}")
    except Exception as e:
        print(f"  UI fill failed: {e}")

    # Klik Szukaj (+ Enter w polu jako fallback wyzwalający TripSearch)
    try:
        page.click('#search-button')
        time.sleep(2)
        page.locator('input[name="tripNumber"], #tripnumber-input').press("Enter")
        time.sleep(6)
        page.wait_for_load_state("networkidle", timeout=15000)
    except Exception as e:
        print(f"  UI search click: {e}")

    # Przechwyć DOM wyników
    try:
        target = page.locator('#trip-content-target')
        if target.count() > 0:
            html = target.inner_html()
            captured["dom"] = html
            save(out, "trip_content_target.html", html)
        save(out, "result_page.html", page.content())
    except Exception as e:
        print(f"  UI capture failed: {e}")

    return captured


def summarize(direct: dict, ui: dict) -> dict:
    """Wyciąga klasy CSS, nazwy, role z najlepszej odpowiedzi (do napisania parsera)."""
    candidates = []
    for url, r in direct.items():
        if isinstance(r, dict) and r.get("body") and not r.get("denied") and not r.get("error_page"):
            candidates.append(r["body"])
    for n in ui.get("network", []):
        if n.get("body"):
            candidates.append(n["body"])
    if ui.get("dom"):
        candidates.append(ui["dom"])

    summary = {"usable_responses": len(candidates)}
    if candidates:
        # Bierzemy najdłuższą sensowną odpowiedź
        best = max(candidates, key=len)
        summary["classes"] = sorted(set(re.findall(r'class="([^"]*)"', best)))[:80]
        summary["data_attrs"] = sorted(set(re.findall(r'(data-[\w-]+)=', best)))[:40]
        # Potencjalne role / nazwiska (uppercase wyrazy, typowe role kolejowe)
        summary["role_hints"] = sorted(set(re.findall(
            r'(Kierownik|Konduktor|Maszynista|Zugführer|Zugchef|Schaffner|Triebfahrzeugführer|Lokführer|Begleiter)[^<]{0,30}',
            best, re.I,
        )))[:30]
        summary["upper_names"] = sorted(set(re.findall(r'\b[A-ZŁŚŻŹĆ][A-ZŁŚŻŹĆ]{2,}(?:\s+[A-ZŁŚŻŹĆ]{2,})+', best)))[:30]
    return summary


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--login", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--date", default=datetime.now().strftime("%Y-%m-%d"),
                        help="Data ISO YYYY-MM-DD (domyślnie dziś)")
    parser.add_argument("--trip", default="6200", help="Numer pociągu (domyślnie 6200)")
    parser.add_argument("--headed", action="store_true")
    args = parser.parse_args()

    out = setup_output()
    print(f"Output: {out}")
    print(f"Date={args.date}  Trip={args.trip}\n")

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

        print("[1] Logowanie ...")
        if not do_login(page, args.login, args.password):
            print("  Login failed!")
            browser.close()
            return
        print("  Zalogowano\n")

        print("[2] Próba bezpośrednia _-crew-on-trip-table ...")
        direct = try_direct(page, args.date, args.trip)
        save_json(out, "direct_attempts.json", direct)

        print("\n[3] Automatyzacja UI (fallback) ...")
        ui = try_ui(page, out, args.date, args.trip)
        save_json(out, "ui_capture.json", ui)

        print("\n[4] Podsumowanie struktury ...")
        summary = summarize(direct, ui)
        save_json(out, "summary.json", summary)
        print(json.dumps(summary, ensure_ascii=False, indent=2)[:2000])

        print(f"\n{'='*60}")
        print(f"CREW RECON COMPLETE — output: {out}")
        print(f"{'='*60}")

        browser.close()


if __name__ == "__main__":
    main()
