import { chromium, Browser, Page } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import type { GoldenRecordStep } from '../utils/golden-records-service';

interface ScreenshotCaptureOptions {
  journeyType: string;
  versionNumber: number;
  steps: GoldenRecordStep[];
  adminSessionCookie?: string;
  baseUrl?: string;
  outputDir?: string;
}

interface ScreenshotResult {
  success: boolean;
  screenshotPath?: string;
  error?: string;
}

export class ScreenshotCaptureService {
  private baseUrl: string;
  private outputDir: string;

  constructor() {
    this.baseUrl = process.env.SCREENSHOT_BASE_URL || 'http://localhost:5000';
    this.outputDir = process.env.GOLDEN_RECORD_SCREENSHOT_DIR || 
      join(process.cwd(), 'scripts/output/golden-records-screenshots');
  }

  async captureStepScreenshots(options: ScreenshotCaptureOptions): Promise<GoldenRecordStep[]> {
    const {
      journeyType,
      versionNumber,
      steps,
      adminSessionCookie,
      baseUrl = this.baseUrl,
      outputDir = this.outputDir,
    } = options;

    console.log(`\n📸 [Screenshot Capture] Starting screenshot capture for ${journeyType} v${versionNumber}`);
    console.log(`   Base URL: ${baseUrl}`);
    console.log(`   Output directory: ${outputDir}`);
    console.log(`   Steps to capture: ${steps.length}`);

    let browser: Browser | undefined;
    const updatedSteps = [...steps];

    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const context = await browser.newContext();
      
      if (adminSessionCookie) {
        await context.addCookies([{
          name: 'connect.sid',
          value: adminSessionCookie,
          domain: 'localhost',
          path: '/',
        }]);
      }

      const page = await context.newPage();

      for (let i = 0; i < updatedSteps.length; i++) {
        const step = updatedSteps[i];
        
        if (!step.expectedUrl) {
          console.log(`   ⚠️  Step ${i + 1} (${step.stepName}): No expectedUrl, skipping screenshot`);
          continue;
        }

        const result = await this.captureStepScreenshot({
          page,
          step,
          stepIndex: i,
          journeyType,
          versionNumber,
          baseUrl,
          outputDir,
        });

        if (result.success && result.screenshotPath) {
          updatedSteps[i] = {
            ...step,
            screenshotPath: result.screenshotPath,
          };
          console.log(`   ✓ Step ${i + 1} (${step.stepName}): Screenshot saved`);
        } else {
          console.log(`   ⚠️  Step ${i + 1} (${step.stepName}): ${result.error}`);
        }
      }

      await browser.close();
      console.log(`\n✅ [Screenshot Capture] Completed: ${updatedSteps.filter(s => s.screenshotPath).length}/${steps.length} screenshots captured\n`);
      
      return updatedSteps;
    } catch (error) {
      console.error('\n❌ [Screenshot Capture] Fatal error:', error);
      
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
      
      console.warn('⚠️  [Screenshot Capture] Continuing without screenshots due to error');
      return steps;
    }
  }

  private async captureStepScreenshot(params: {
    page: Page;
    step: GoldenRecordStep;
    stepIndex: number;
    journeyType: string;
    versionNumber: number;
    baseUrl: string;
    outputDir: string;
  }): Promise<ScreenshotResult> {
    const { page, step, journeyType, versionNumber, baseUrl, outputDir } = params;

    try {
      const url = `${baseUrl}${step.expectedUrl}`;
      
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      await page.waitForSelector('body', { timeout: 5000 });

      await page.waitForTimeout(1000);

      const screenshotDir = join(outputDir, journeyType, `v${versionNumber}`);
      await mkdir(screenshotDir, { recursive: true });

      const filename = `${step.stepName}.png`;
      const fullPath = join(screenshotDir, filename);
      const relativePath = `golden-records-screenshots/${journeyType}/v${versionNumber}/${filename}`;

      await page.screenshot({
        path: fullPath,
        fullPage: true,
      });

      return {
        success: true,
        screenshotPath: relativePath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getAdminSessionCookie(): Promise<string | undefined> {
    return undefined;
  }
}

export const screenshotCaptureService = new ScreenshotCaptureService();
