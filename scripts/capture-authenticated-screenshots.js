import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000';
const SCREENSHOT_DIR = './docs/screenshots';

const REAL_DATA_IDS = {
  segmentDiscovery: '8652864e-5b00-4409-98a5-aefeced2ffcb',
  journeySession: 'a6bb4d87-b03d-4f02-8216-5fdcc4fc55d1',
  epmProgram: '40fe03c0-a10c-4b7f-a08b-6351f9a8d01f'
};

async function authenticateWithReplit(page) {
  console.log('🔐 Starting authentication flow...');
  
  await page.goto(`${BASE_URL}/strategic-consultant`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  const loginButton = await page.$('[data-testid="login-button"], button:has-text("Sign in"), a:has-text("Sign in"), button:has-text("Log in")');
  
  if (loginButton) {
    console.log('   Found login button, clicking...');
    await loginButton.click();
    await page.waitForTimeout(5000);
    
    await page.waitForURL(url => !url.href.includes('/api/login'), { timeout: 60000 }).catch(() => {});
    
    console.log('   ✓ Authentication flow completed');
  } else {
    console.log('   Already authenticated or no login button found');
  }
  
  await page.waitForTimeout(2000);
  return true;
}

async function waitForDataLoad(page, selectors = [], timeout = 10000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
    
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: timeout / 2 });
      } catch (e) {
      }
    }
    
    await page.waitForTimeout(1500);
  } catch (e) {
    await page.waitForTimeout(3000);
  }
}

async function captureScreenshots() {
  console.log('📸 Premisia Authenticated Screenshot Capture');
  console.log('============================================\n');
  
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();

  try {
    await authenticateWithReplit(page);
  } catch (error) {
    console.log('⚠️  Authentication may not be fully complete:', error.message);
  }

  const screenshots = [
    { 
      name: '00-landing', 
      url: '/', 
      wait: 3000,
      description: 'Landing Page',
      waitFor: ['h1', '.hero', 'main']
    },
    { 
      name: '01-marketing-input', 
      url: '/marketing-consultant', 
      wait: 3000,
      description: 'Marketing Consultant - Input Page',
      waitFor: ['textarea', 'form', '[data-testid]']
    },
    { 
      name: '02-segment-discovery', 
      url: `/marketing-consultant/segment-discovery/${REAL_DATA_IDS.segmentDiscovery}`, 
      wait: 5000,
      description: 'Segment Discovery Results - 8 Dimensions & Genomes',
      waitFor: ['.dimension', '[class*="genome"]', '[class*="card"]'],
      fullPage: true
    },
    { 
      name: '03-strategic-input', 
      url: '/strategic-consultant', 
      wait: 3000,
      description: 'Strategic Consultant - Input Page',
      waitFor: ['textarea', 'form']
    },
    { 
      name: '04-journey-hub', 
      url: '/journeys', 
      wait: 3000,
      description: 'Journey Hub - Available Strategic Journeys',
      waitFor: ['[class*="journey"]', '[class*="card"]', 'main']
    },
    { 
      name: '05-journey-results', 
      url: `/strategic-consultant/journey-results/${REAL_DATA_IDS.journeySession}`, 
      wait: 5000,
      description: 'Strategic Journey Results - BMI Analysis',
      waitFor: ['[class*="result"]', '[class*="canvas"]', 'main'],
      fullPage: true
    },
    { 
      name: '06-programs-list', 
      url: '/strategy-workspace/programs', 
      wait: 4000,
      description: 'Strategy Workspace - Programs List',
      waitFor: ['table', '[class*="program"]', '[class*="card"]']
    },
    { 
      name: '07-epm-overview', 
      url: `/strategy-workspace/epm/${REAL_DATA_IDS.epmProgram}`, 
      wait: 5000,
      description: 'EPM Dashboard - Overview Tab',
      waitFor: ['[class*="tab"]', '[class*="overview"]', 'main'],
      fullPage: true
    }
  ];

  const epmTabs = [
    { name: '08-epm-tasks', tab: 'Tasks', description: 'EPM Dashboard - Tasks & Work Breakdown' },
    { name: '09-epm-resources', tab: 'Resources', description: 'EPM Dashboard - Resource Allocation' },
    { name: '10-epm-risks', tab: 'Risks', description: 'EPM Dashboard - Risk Register' }
  ];

  for (const shot of screenshots) {
    try {
      console.log(`📷 Capturing ${shot.name}: ${shot.description}...`);
      await page.goto(`${BASE_URL}${shot.url}`, { waitUntil: 'networkidle', timeout: 45000 });
      
      await waitForDataLoad(page, shot.waitFor || [], 10000);
      await page.waitForTimeout(shot.wait);
      
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, `${shot.name}.png`),
        fullPage: shot.fullPage || false
      });
      console.log(`   ✓ Saved ${shot.name}.png`);
    } catch (err) {
      console.log(`   ✗ Failed ${shot.name}: ${err.message}`);
    }
  }

  for (const tabShot of epmTabs) {
    try {
      console.log(`📷 Capturing ${tabShot.name}: ${tabShot.description}...`);
      
      await page.goto(`${BASE_URL}/strategy-workspace/epm/${REAL_DATA_IDS.epmProgram}`, { 
        waitUntil: 'networkidle', 
        timeout: 45000 
      });
      await page.waitForTimeout(3000);
      
      const tabButton = await page.$(
        `button:has-text("${tabShot.tab}"), [role="tab"]:has-text("${tabShot.tab}"), a:has-text("${tabShot.tab}")`
      );
      
      if (tabButton) {
        await tabButton.click();
        await page.waitForTimeout(3000);
        await waitForDataLoad(page, [], 5000);
      }
      
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, `${tabShot.name}.png`),
        fullPage: true
      });
      console.log(`   ✓ Saved ${tabShot.name}.png`);
    } catch (err) {
      console.log(`   ✗ Failed ${tabShot.name}: ${err.message}`);
    }
  }

  await browser.close();
  
  console.log('\n✅ Screenshot capture complete!');
  console.log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}`);
  
  return true;
}

captureScreenshots().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
