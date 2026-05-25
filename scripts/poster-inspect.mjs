import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8000/design/wc-poster/poster.html');
await page.waitForLoadState('networkidle');
const info = await page.evaluate(() => {
  const c = document.querySelector('#standalone .centre-stack');
  if (!c) return { err: 'no .centre-stack' };
  const cs = getComputedStyle(c);
  return {
    html: c.outerHTML.slice(0, 1500),
    width: c.clientWidth, height: c.clientHeight,
    rect: c.getBoundingClientRect(),
    display: cs.display, flexDir: cs.flexDirection,
    childCount: c.children.length,
    children: [...c.children].map(ch => ({
      cls: ch.className,
      w: ch.clientWidth, h: ch.clientHeight,
      slotCount: ch.querySelectorAll('.slot').length,
    })),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
