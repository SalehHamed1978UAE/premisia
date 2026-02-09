import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import { BaseExporter, type FullExportPackage, type ExportResult } from './base-exporter';

let cachedChromiumPath: string | undefined | null = null;

export function findChromiumExecutable(): string | undefined {
  if (cachedChromiumPath !== null) {
    return cachedChromiumPath || undefined;
  }

  try {
    const path = execSync('command -v chromium-browser || command -v chromium || command -v google-chrome', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    cachedChromiumPath = path || undefined;
    
    if (cachedChromiumPath) {
      console.log('[Export Service] Chromium executable found:', cachedChromiumPath);
    } else {
      console.warn('[Export Service] Chromium executable not found - PDF generation will be skipped');
    }
    
    return cachedChromiumPath;
  } catch (error) {
    console.warn('[Export Service] Failed to locate Chromium executable:', error instanceof Error ? error.message : String(error));
    cachedChromiumPath = undefined;
    return undefined;
  }
}

export class PdfExporter extends BaseExporter {
  readonly name = 'PDF Exporter';
  readonly format = 'pdf';
  readonly mimeType = 'application/pdf';

  isAvailable(): boolean {
    return findChromiumExecutable() !== undefined;
  }

  async export(pkg: FullExportPackage): Promise<ExportResult> {
    if (!this.isAvailable()) {
      return {
        filename: 'report.pdf',
        content: Buffer.from(''),
        mimeType: this.mimeType,
        success: false,
        error: 'Chromium not available for PDF generation',
      };
    }

    return {
      filename: 'report.pdf',
      content: Buffer.from(''),
      mimeType: this.mimeType,
      success: false,
      error: 'Use generatePdfFromHtml or generatePdfFromUiHtml directly',
    };
  }
}

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const chromiumPath = findChromiumExecutable();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: chromiumPath,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      printBackground: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function generatePdfFromUiHtml(html: string): Promise<Buffer> {
  const chromiumPath = findChromiumExecutable();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: chromiumPath,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      printBackground: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
