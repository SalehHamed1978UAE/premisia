import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000';
const SCREENSHOT_DIR = './docs/screenshots';

const IDS = {
  segmentDiscovery: 'c72a084c-d4af-400d-908e-1925d55d0109',
  epmProgram: '40fe03c0-a10c-4b7f-a08b-6351f9a8d01f'
};

async function waitForPageLoad(page, timeout = 10000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
    await page.waitForTimeout(2000);
  } catch (e) {
    await page.waitForTimeout(3000);
  }
}

async function clickTab(page, tabText) {
  const tabSelectors = [
    `[role="tab"]:has-text("${tabText}")`,
    `button:has-text("${tabText}")`,
    `[data-state][value="${tabText.toLowerCase().replace(/\s+/g, '-')}"]`,
    `.tab:has-text("${tabText}")`,
    `[class*="TabsTrigger"]:has-text("${tabText}")`
  ];
  
  for (const selector of tabSelectors) {
    try {
      const tab = await page.$(selector);
      if (tab) {
        await tab.click();
        await page.waitForTimeout(2000);
        await waitForPageLoad(page, 5000);
        return true;
      }
    } catch (e) {}
  }
  console.log(`   ⚠️  Could not find tab: ${tabText}`);
  return false;
}

async function captureScreenshots() {
  console.log('📸 Premisia Exhaustive Screenshot Capture');
  console.log('==========================================\n');
  
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  console.log('🔐 Setting up authentication...');
  await page.goto(`${BASE_URL}/marketing-consultant`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(3000);
  
  const loginButton = await page.$('[data-testid="login-button"], button:has-text("Sign in"), a:has-text("Sign in")');
  if (loginButton) {
    console.log('   Found login button - attempting auth...');
    await loginButton.click();
    await page.waitForTimeout(8000);
  }
  console.log('   ✓ Authentication setup complete\n');

  const results = [];

  console.log('📷 1. Marketing Consultant Input Page');
  try {
    await page.goto(`${BASE_URL}/marketing-consultant`, { waitUntil: 'networkidle', timeout: 45000 });
    await waitForPageLoad(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-marketing-consultant-input.png'), fullPage: false });
    results.push({ name: '01-marketing-consultant-input.png', success: true });
    console.log('   ✓ Saved 01-marketing-consultant-input.png');
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
    results.push({ name: '01-marketing-consultant-input.png', success: false });
  }

  console.log('📷 2. Segment Discovery Results - Beachhead Tab');
  try {
    await page.goto(`${BASE_URL}/marketing-consultant/results/${IDS.segmentDiscovery}`, { 
      waitUntil: 'networkidle', 
      timeout: 45000 
    });
    await waitForPageLoad(page);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-segment-results-beachhead.png'), fullPage: true });
    results.push({ name: '02-segment-results-beachhead.png', success: true });
    console.log('   ✓ Saved 02-segment-results-beachhead.png');
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
    results.push({ name: '02-segment-results-beachhead.png', success: false });
  }

  console.log('📷 3. Segment Discovery Results - Top 20 Segments Tab');
  try {
    await clickTab(page, 'Top 20 Segments');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-segment-results-top20.png'), fullPage: true });
    results.push({ name: '03-segment-results-top20.png', success: true });
    console.log('   ✓ Saved 03-segment-results-top20.png');
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
    results.push({ name: '03-segment-results-top20.png', success: false });
  }

  console.log('📷 4. Segment Discovery Results - Gene Library Tab');
  try {
    await clickTab(page, 'Gene Library');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-segment-results-genelibrary.png'), fullPage: true });
    results.push({ name: '04-segment-results-genelibrary.png', success: true });
    console.log('   ✓ Saved 04-segment-results-genelibrary.png');
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
    results.push({ name: '04-segment-results-genelibrary.png', success: false });
  }

  console.log('📷 5. My Discoveries Page');
  try {
    await page.goto(`${BASE_URL}/marketing-consultant/discoveries`, { waitUntil: 'networkidle', timeout: 45000 });
    await waitForPageLoad(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-my-discoveries.png'), fullPage: false });
    results.push({ name: '05-my-discoveries.png', success: true });
    console.log('   ✓ Saved 05-my-discoveries.png');
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
    results.push({ name: '05-my-discoveries.png', success: false });
  }

  console.log('📷 6. Strategic Consultant Input Page');
  try {
    await page.goto(`${BASE_URL}/strategic-consultant`, { waitUntil: 'networkidle', timeout: 45000 });
    await waitForPageLoad(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-strategic-consultant-input.png'), fullPage: false });
    results.push({ name: '06-strategic-consultant-input.png', success: true });
    console.log('   ✓ Saved 06-strategic-consultant-input.png');
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
    results.push({ name: '06-strategic-consultant-input.png', success: false });
  }

  console.log('📷 7. Journey Hub');
  try {
    await page.goto(`${BASE_URL}/journeys`, { waitUntil: 'networkidle', timeout: 45000 });
    await waitForPageLoad(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-journey-hub.png'), fullPage: false });
    results.push({ name: '07-journey-hub.png', success: true });
    console.log('   ✓ Saved 07-journey-hub.png');
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
    results.push({ name: '07-journey-hub.png', success: false });
  }

  console.log('📷 8. Programs List');
  try {
    await page.goto(`${BASE_URL}/strategy-workspace/programs`, { waitUntil: 'networkidle', timeout: 45000 });
    await waitForPageLoad(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-programs-list.png'), fullPage: false });
    results.push({ name: '08-programs-list.png', success: true });
    console.log('   ✓ Saved 08-programs-list.png');
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
    results.push({ name: '08-programs-list.png', success: false });
  }

  console.log('📷 9. EPM Program Overview');
  try {
    await page.goto(`${BASE_URL}/strategy-workspace/epm/${IDS.epmProgram}`, { 
      waitUntil: 'networkidle', 
      timeout: 45000 
    });
    await waitForPageLoad(page);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-epm-overview.png'), fullPage: true });
    results.push({ name: '09-epm-overview.png', success: true });
    console.log('   ✓ Saved 09-epm-overview.png');
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
    results.push({ name: '09-epm-overview.png', success: false });
  }

  console.log('📷 10. EPM Resources Tab');
  try {
    await clickTab(page, 'Resources');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-epm-resources.png'), fullPage: true });
    results.push({ name: '10-epm-resources.png', success: true });
    console.log('   ✓ Saved 10-epm-resources.png');
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
    results.push({ name: '10-epm-resources.png', success: false });
  }

  console.log('📷 11. EPM Risks Tab');
  try {
    await page.goto(`${BASE_URL}/strategy-workspace/epm/${IDS.epmProgram}`, { waitUntil: 'networkidle', timeout: 45000 });
    await waitForPageLoad(page);
    await clickTab(page, 'Risks');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-epm-risks.png'), fullPage: true });
    results.push({ name: '11-epm-risks.png', success: true });
    console.log('   ✓ Saved 11-epm-risks.png');
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
    results.push({ name: '11-epm-risks.png', success: false });
  }

  console.log('📷 12. EPM KPIs Tab');
  try {
    await page.goto(`${BASE_URL}/strategy-workspace/epm/${IDS.epmProgram}`, { waitUntil: 'networkidle', timeout: 45000 });
    await waitForPageLoad(page);
    await clickTab(page, 'KPIs');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12-epm-kpis.png'), fullPage: true });
    results.push({ name: '12-epm-kpis.png', success: true });
    console.log('   ✓ Saved 12-epm-kpis.png');
  } catch (e) {
    console.log(`   ✗ Failed: ${e.message}`);
    results.push({ name: '12-epm-kpis.png', success: false });
  }

  await browser.close();
  
  console.log('\n==========================================');
  console.log('📊 Capture Summary:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`   ✓ Successful: ${successful}`);
  console.log(`   ✗ Failed: ${failed}`);
  console.log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}`);
  
  return results;
}

captureScreenshots().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
