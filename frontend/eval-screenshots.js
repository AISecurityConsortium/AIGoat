/**
 * UI/UX Evaluation Screenshot Script for AI Goat
 * Captures screenshots at each evaluation step
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR = path.join(__dirname, 'eval-screenshots');

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function screenshot(page, name) {
  ensureDir(SCREENSHOTS_DIR);
  const filepath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`  ✓ ${name}.png`);
}

async function run() {
  console.log('Starting UI evaluation...\n');
  ensureDir(SCREENSHOTS_DIR);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  try {
    // 1. Home page (not logged in)
    console.log('1. Home page (not logged in)...');
    await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await screenshot(page, '01-home-not-logged-in');

    // 2. Light theme
    console.log('2. Light theme...');
    const themeBtn = page.locator('button[title*="light mode"], button[title*="dark mode"]').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(800);
    }
    await screenshot(page, '02-home-light-theme');

    // 3. Switch back to dark theme
    console.log('3. Switching back to dark theme...');
    if (await themeBtn.isVisible()) await themeBtn.click();
    await page.waitForTimeout(600);

    // 4. Login page
    console.log('4. Login page...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await screenshot(page, '04-login-page');

    // Login with alice/password123
    console.log('5. Logging in (alice/password123)...');
    await page.fill('input[name="username"]', 'alice');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(home|admin)/, { timeout: 10000 });
    await page.waitForTimeout(1500);

    // 5. Home page (logged in)
    console.log('6. Home page (logged in)...');
    await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await screenshot(page, '05-home-logged-in');

    // 6. Search "cap"
    console.log('7. Search "cap"...');
    const searchInput = page.locator('input[placeholder*="Search products"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('cap');
      await page.waitForTimeout(800);
    }
    await screenshot(page, '06-search-cap');

    // 7. Product detail
    console.log('8. Product detail page...');
    await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const productCard = page.locator('[class*="MuiCard-root"]').first();
    if (await productCard.isVisible()) {
      await productCard.click();
      await page.waitForURL(/\/product\//, { timeout: 5000 });
      await page.waitForTimeout(1500);
    }
    await screenshot(page, '07-product-detail');

    // 8. Chatbot FAB
    console.log('9. Chatbot FAB...');
    const chatFab = page.locator('button[aria-label="chat"], [class*="MuiFab-root"]').first();
    if (await chatFab.isVisible()) {
      await chatFab.click();
      await page.waitForTimeout(1200);
    }
    await screenshot(page, '08-chatbot-open');

    // Close chatbot for cart
    try {
      const minBtn = page.locator('button[title*="Minimize"], button[title*="Maximize"]').first();
      if (await minBtn.isVisible()) await minBtn.click();
      await page.waitForTimeout(400);
    } catch (_) {}

    // 9. Cart - add product first
    console.log('10. Cart page...');
    await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const productCards = page.locator('div[class*="MuiCard-root"]').filter({ has: page.locator('img') });
    const firstCard = productCards.first();
    if (await firstCard.isVisible()) {
      const addCartBtn = firstCard.locator('button[aria-label*="add"], button').filter({ has: page.locator('svg') }).last();
      if (await addCartBtn.isVisible()) await addCartBtn.click();
      await page.waitForTimeout(600);
    }
    await page.goto(`${BASE_URL}/cart`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await screenshot(page, '09-cart');

    // 10. OWASP Top 10
    console.log('11. OWASP Top 10...');
    await page.goto(`${BASE_URL}/owasp-top-10`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await screenshot(page, '10-owasp-top-10');

    // 11. Attack Labs
    console.log('12. Attack Labs...');
    await page.goto(`${BASE_URL}/attacks`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await screenshot(page, '11-attack-labs');

    // 12. Challenges
    console.log('13. Challenges...');
    await page.goto(`${BASE_URL}/challenges`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await screenshot(page, '12-challenges');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
    console.log('\nScreenshots saved to:', SCREENSHOTS_DIR);
  }
}

run();
