const puppeteer = require('puppeteer-core');
const path = require('path');

// Common Edge/Chrome paths on Windows
const BROWSER_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

(async () => {
  const executablePath = BROWSER_PATHS.find(p => {
    try { require('fs').accessSync(p); return true; } catch { return false; }
  });

  if (!executablePath) {
    console.error('No Chrome/Edge found. Install Chrome or set executablePath manually.');
    process.exit(1);
  }

  console.log('Using browser:', executablePath);

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const htmlPath = path.resolve(__dirname, 'index.html');

  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0', timeout: 60000 });

  // Wait for Chart.js to finish rendering all charts
  await page.waitForFunction('window.chartsReady === true', { timeout: 30000 });

  // Small buffer for final paint
  await new Promise(r => setTimeout(r, 500));

  const outputPath = path.resolve(__dirname, '..', 'STEDA_Report_Enhanced.pdf');

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await browser.close();
  console.log(`✅  PDF saved → ${outputPath}`);
})();
