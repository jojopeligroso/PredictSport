import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1200, height: 1100 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const logs = [];
p.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
p.on('pageerror', e => logs.push(`[err] ${e.message}`));
await p.goto('http://127.0.0.1:8000/design/wc-poster/poster.html');
await p.waitForLoadState('networkidle');

// Force standalone into folded view and switch to Side B
await p.evaluate(() => {
  const root = document.getElementById('standalone');
  root.querySelectorAll('[data-view-pane]').forEach(pane => {
    pane.classList.toggle('hide', pane.dataset.viewPane !== 'folded');
  });
});
// Click the Side B tab in standalone
await p.click('#standalone [data-side-tab="B"]');
await p.waitForTimeout(300);

await p.locator('#standalone .folded').screenshot({ path: '/tmp/folded_b.png' });
console.log('logs:', logs);
await b.close();
