import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000';
const SCREENSHOT_DIR = './docs/screenshots';

async function captureScreenshots() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  const screenshots = [
    { name: '01-landing', url: '/', wait: 2000 },
    { name: '02-marketing-input', url: '/marketing-consultant', wait: 2000 },
    { name: '03-journey-hub', url: '/journeys', wait: 2000 },
    { name: '04-strategic-input', url: '/strategic-consultant', wait: 2000 },
  ];

  for (const shot of screenshots) {
    try {
      console.log(`Capturing ${shot.name}...`);
      await page.goto(`${BASE_URL}${shot.url}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(shot.wait);
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, `${shot.name}.png`),
        fullPage: false 
      });
      console.log(`  ✓ Saved ${shot.name}.png`);
    } catch (err) {
      console.log(`  ✗ Failed ${shot.name}: ${err.message}`);
    }
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to', SCREENSHOT_DIR);
}

captureScreenshots().catch(console.error);
