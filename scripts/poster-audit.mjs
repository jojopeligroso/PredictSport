import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:8000/design/wc-poster/poster.html';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
await page.goto(URL);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/tmp/poster_desktop.png', fullPage: true });
const info = await page.evaluate(() => {
  const q = s => document.querySelector(s);
  const f = el => el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null;
  return {
    pillCount: document.querySelectorAll('.pill-frame').length,
    groupCardCount: document.querySelectorAll('.group-card').length,
    firstGroupCard: f(q('.group-card')),
    firstPill: f(q('.group-card .pill-frame')),
    firstPillClipPath: q('.group-card .pill-frame')?.style.clipPath || '(none)',
    poster: f(q('#standalone')),
    unfolded: f(q('[data-view-pane="unfolded"] .unfolded')),
    railLeft: f(q('[data-rail="left"]')),
    bracket: f(q('.bracket')),
    firstSlot: f(q('.slot')),
    finalSlots: document.querySelectorAll('.final-pair .slot').length,
    r32Count: document.querySelectorAll('.round.r32 .slot').length,
    r16Count: document.querySelectorAll('.round.r16 .slot').length,
    qfCount:  document.querySelectorAll('.round.qf  .slot').length,
    sfCount:  document.querySelectorAll('.round.sf  .slot').length,
    firstR16Slot: f(q('.round.r16 .slot')),
    firstQfSlot:  f(q('.round.qf  .slot')),
    firstSfSlot:  f(q('.round.sf  .slot')),
    championPill: f(q('.champion-card .pill-frame')),
  };
});
await ctx.close();
const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await m.newPage();
await mp.goto(URL);
await mp.waitForLoadState('networkidle');
await mp.screenshot({ path: '/tmp/poster_mobile.png', fullPage: true });
await m.close();
await browser.close();
console.log('--- logs ---'); logs.forEach(l => console.log(l));
console.log('--- dims ---'); for (const [k,v] of Object.entries(info)) console.log(`${k.padStart(22)}: ${JSON.stringify(v)}`);
