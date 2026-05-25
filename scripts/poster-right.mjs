import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8000/design/wc-poster/poster.html');
await page.waitForLoadState('networkidle');

// Zoomed crop of just the right half
const bracket = page.locator('#standalone .bracket').first();
const bb = await bracket.boundingBox();
await page.screenshot({
  path: '/tmp/poster_right.png',
  clip: { x: bb.x + bb.width/2 - 80, y: bb.y, width: bb.width/2 + 100, height: bb.height }
});

// Inspect: what edges are R32R lines drawn from?
const info = await page.evaluate(() => {
  const bracket = document.querySelector('#standalone .bracket');
  const bbRect = bracket.getBoundingClientRect();
  const r32R = document.querySelector('#standalone .round.r32.right');
  const r16R = document.querySelectorAll('#standalone .round.r16')[1];
  if (!r32R || !r16R) return { err: 'rounds not found' };
  const r32Slots = [...r32R.querySelectorAll('.slot')].map(s => {
    const r = s.getBoundingClientRect();
    return {
      left: Math.round(r.left - bbRect.left),
      right: Math.round(r.right - bbRect.left),
      midY: Math.round(r.top - bbRect.top + r.height/2),
    };
  });
  const r16Slots = [...r16R.querySelectorAll('.slot')].map(s => {
    const r = s.getBoundingClientRect();
    return {
      left: Math.round(r.left - bbRect.left),
      right: Math.round(r.right - bbRect.left),
      midY: Math.round(r.top - bbRect.top + r.height/2),
    };
  });
  // Read which paths are in the SVG for the right side (looking for "M <x> ..." where x is > bbRect.width/2)
  const paths = [...document.querySelectorAll('#standalone .bracket-lines path')].map(p => p.getAttribute('d'));
  const rightPaths = paths.filter(d => {
    const m = d.match(/M\s+(\d+(?:\.\d+)?)/);
    return m && parseFloat(m[1]) > bbRect.width/2;
  });
  return {
    r32Slots: r32Slots.slice(0, 4),
    r16Slots: r16Slots.slice(0, 2),
    samplePaths: rightPaths.slice(0, 8),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
