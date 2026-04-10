import fs from 'fs';
import type { InvoiceEmailParams } from './invoice-email';
import { generateInvoicePdfDocumentHtml } from './invoice-email';

function resolveChromeExecutable(): string | undefined {
  if (process.env.CHROME_EXECUTABLE_PATH && fs.existsSync(process.env.CHROME_EXECUTABLE_PATH)) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }

  if (process.platform === 'win32') {
    const candidates = [
      process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : '',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ].filter(Boolean);
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return undefined;
  }

  if (process.platform === 'darwin') {
    const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(mac)) return mac;
    return undefined;
  }

  const linux = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'];
  for (const p of linux) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

/**
 * 거래명세표 HTML을 PDF 버퍼로 변환합니다.
 * 로컬: Chrome 설치 경로 또는 CHROME_EXECUTABLE_PATH 필요.
 * Vercel 등: @sparticuz/chromium 번들 사용.
 */
export async function renderInvoicePdfBuffer(params: InvoiceEmailParams): Promise<Buffer | null> {
  const html = generateInvoicePdfDocumentHtml(params);
  const puppeteer = (await import('puppeteer-core')).default;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

  try {
    if (process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const chromium = (await import('@sparticuz/chromium')).default;
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      const executablePath = resolveChromeExecutable();
      if (!executablePath) {
        console.warn(
          '[invoice PDF] Chrome/Chromium을 찾지 못했습니다. CHROME_EXECUTABLE_PATH를 설정하거나 Chrome을 설치하세요.',
        );
        return null;
      }
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    }

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(45_000);
    page.setDefaultTimeout(45_000);
    // networkidle0 는 서버리스에서 대기만 길어지거나 타임아웃나기 쉬움 (정적 HTML만 사용)
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });
    await browser.close();
    browser = undefined;
    return Buffer.from(pdf);
  } catch (e) {
    console.error('[invoice PDF] 생성 실패:', e);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return null;
  }
}
