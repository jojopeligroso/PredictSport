import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await b.newPage();
await p.goto('http://127.0.0.1:8000/design/wc-poster/poster.html');
await p.waitForLoadState('networkidle');
const info = await p.evaluate(() => {
  const c = document.querySelector('#standalone .centre-stack');
  const finalPair = c.querySelector('.final-pair');
  const top = finalPair.children[0];
  const bot = finalPair.children[1];
  const r1 = top.getBoundingClientRect();
  const r2 = bot.getBoundingClientRect();
  return {
    finalPair: { w: finalPair.clientWidth, h: finalPair.clientHeight, rect: finalPair.getBoundingClientRect() },
    topSlot: { w: top.clientWidth, h: top.clientHeight, rect: r1 },
    botSlot: { w: bot.clientWidth, h: bot.clientHeight, rect: r2 },
    topPillFrameBg: getComputedStyle(top.querySelector('.pill-frame')).background,
    overlap: r1.bottom > r2.top ? 'OVERLAPPING' : 'separated',
    distance: r2.top - r1.bottom,
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
