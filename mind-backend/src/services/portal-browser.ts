import { chromium, Browser } from 'playwright-core';

const PORTAL_BASE = 'https://portal.intercity.pl';
const DESKTOP_BASE = `${PORTAL_BASE}/mbweb/main/matter/desktop`;

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

export async function confirmTimecardPlaywright(
  date: string,
  allocationId: string,
  token: string,
): Promise<{ success: boolean; message: string }> {
  let browser: Browser | null = null;

  try {

    browser = await chromium.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    await context.addCookies([
      { name: 'IvuPadAuthToken', value: token, domain: 'portal.intercity.pl', path: '/' },
    ]);

    // Load SPA and navigate to duty-details fragment to establish full browser session
    // Use 'load' — portal keeps long-polling (CouchDB), so 'networkidle' never fires
    await page.goto(`${DESKTOP_BASE}/duty-details?beginDate=${date}&sync=true`, {
      waitUntil: 'load',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // POST from browser context (all Akamai cookies present)
    const postResult = await page.evaluate(
      async ({ allocId, url }) => {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ allocationId: allocId }),
          });
          return { status: res.status, body: await res.text(), ok: res.ok };
        } catch (e) {
          return { status: 0, body: String(e), ok: false };
        }
      },
      { allocId: allocationId, url: `${DESKTOP_BASE}/_-json-confirm-allocation` },
    );

    let postJson: { success?: boolean } = {};
    try { postJson = JSON.parse(postResult.body); } catch {}
    console.log(`[Playwright] POST result for ${date}: status=${postResult.status} success=${postJson.success}`);

    if (postResult.ok && postJson.success === true) {
      return { success: true, message: `Confirmed allocation ${allocationId} for ${date} via browser POST` };
    }

    // UI click fallback — works when implicit-confirmation-needed is present in DOM
    const confirmEl = page.locator('.implicit-confirmation-needed:not(.hidden), .status_Zatwierdzona_Wydana[data-submit]:not(.hidden)');
    const confirmElCount = await confirmEl.count();
    console.log(`[Playwright] UI click fallback: found ${confirmElCount} confirmable elements`);

    if (confirmElCount > 0) {
      // Intercept network requests triggered by click
      const confirmedRequests: Array<{ url: string; status: number; body: string }> = [];
      page.on('response', async resp => {
        if (resp.url().includes('confirm-allocation')) {
          const body = await resp.text().catch(() => '');
          confirmedRequests.push({ url: resp.url(), status: resp.status(), body: body.slice(0, 200) });
        }
      });

      await confirmEl.first().click();
      await page.waitForTimeout(3000);

      // Check if click triggered confirmation via JS event handler (network intercept)
      if (confirmedRequests.length > 0) {
        const lastReq = confirmedRequests[confirmedRequests.length - 1];
        try {
          const json = JSON.parse(lastReq.body);
          if (json.success === true) {
            return { success: true, message: `Confirmed via JS click handler for ${date}` };
          }
        } catch {}
      }

      const confirmBtn = page.locator(
        'button:has-text("Bestätigen"), button:has-text("Potwierdź"), button:has-text("Confirm"), .confirm-button, [data-action="confirm"]',
      );
      if ((await confirmBtn.count()) > 0) {
        await confirmBtn.first().click();
        await page.waitForTimeout(2000);
        return { success: true, message: `Confirmed via UI click for ${date}` };
      }
      return { success: false, message: `Clicked allocation but no confirm button appeared for ${date}. Network requests: ${JSON.stringify(confirmedRequests)}` };
    }

    return {
      success: false,
      message: `Nie można potwierdzić przez API — potwierdź ręcznie na portalu.intercity.pl i użyj sync`,
    };
  } catch (e) {
    return { success: false, message: `Playwright error: ${String(e)}` };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
