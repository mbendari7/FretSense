// Temporary driver for a hands-on smoke run (not a committed test). Usage: node e2e/smoke-drive.mjs <outDir>
import { chromium } from '@playwright/test';
const out = process.argv[2];
const browser = await chromium.launch();
const errors = [];
async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto('http://localhost:4173/');
  await page.getByRole('heading', { name: 'Learn the neck you actually play.' }).waitFor();
  await page.screenshot({ path: `${out}/${name}-1-first-run.png`, fullPage: true });
  await page.getByRole('button', { name: /Standard \(EADGBE\)/ }).click();
  await page.getByRole('heading', { name: /mapped/ }).waitFor();
  await page.screenshot({ path: `${out}/${name}-2-home.png`, fullPage: true });
  await page.goto('http://localhost:4173/explore?root=A&scale=minor-pentatonic');
  await page.getByRole('heading', { name: /A minor pentatonic/ }).waitFor();
  await page.getByRole('button', { name: /String 3, fret 7/ }).click();
  await page.screenshot({ path: `${out}/${name}-3-explore.png`, fullPage: true });
  await page.goto('http://localhost:4173/keys?tonic=A&mode=minor&sevenths=1&hm=1');
  await page.screenshot({ path: `${out}/${name}-4-keys.png`, fullPage: true });
  await page.goto('http://localhost:4173/drills/note-finding');
  await page.getByRole('button', { name: 'Start drill' }).click();
  const prompt = await page.locator('#prompt').textContent();
  await page.getByRole('button', { name: /prompted string/ }).nth(3).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/${name}-5-drill.png`, fullPage: true });
  for (let i = 0; i < 25; i++) {
    const next = page.getByRole('button', { name: 'Next question' });
    if (await page.getByRole('heading', { name: 'Drill finished' }).isVisible()) break;
    await page.getByRole('button', { name: /String \d, fret 5/ }).first().click();
    await page.waitForTimeout(80);
    if (await next.isVisible()) await next.click(); else await page.waitForTimeout(700);
  }
  await page.screenshot({ path: `${out}/${name}-6-summary.png`, fullPage: true });
  await page.goto('http://localhost:4173/progress');
  await page.screenshot({ path: `${out}/${name}-7-progress.png`, fullPage: true });
  await page.goto('http://localhost:4173/library');
  await page.screenshot({ path: `${out}/${name}-8-library.png`, fullPage: true });
  const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(name, 'prompt:', prompt, 'pageHScroll:', hscroll);
  await ctx.close();
}
await run('desktop', { width: 1280, height: 860 });
await run('phone', { width: 390, height: 844 });
await browser.close();
console.log('errors:', errors.length ? errors.join('\n') : 'none');
