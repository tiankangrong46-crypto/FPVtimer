import { test, expect, type Page } from '@playwright/test';

import { readFileSync } from 'node:fs';
const parity=JSON.parse(readFileSync('.tools/android/parity-fixtures.json','utf8'));
const flightScenarios: Record<string,{label:string}>=Object.fromEntries(parity.cases.map((c:{style:string;label:string})=>[c.style,{label:c.label}]));
const sample = {weight:'650.5',wheelbase:'225',stator:'2306',kv:'1850',diameter:'5.1',pitch:'3.5',blades:'3',capacity:'1300',cells:'6',minutes:'4',seconds:'30',startVoltage:'25.200',endVoltage:'22.200'};
async function fill(page: Page) { for (const [id,value] of Object.entries(sample)) await page.locator(`#${id}`).fill(value); }
test.beforeEach(async ({page}) => { await page.goto('http://127.0.0.1:1420'); });

test('Android定子标签不挤占输入行，按钮竖横屏对齐且评估与清空有效', async ({browser}) => {
  const context = await browser.newContext({userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36',viewport:{width:390,height:844}});
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:1420');
    await expect(page.locator('label[for="stator"]')).toHaveText('电机定子规格');
    await expect(page.locator('.actionbar .primary span,.actionbar .shortcut')).toHaveCount(0);
    for(const [width,height] of [[320,640],[360,740],[390,844],[430,932],[844,390]]) {
      await page.setViewportSize({width,height});
      const primary = await page.locator('.actionbar .primary').boundingBox();
      const clear = await page.locator('.actionbar .reset').boundingBox();
      expect(primary!.y).toBeCloseTo(clear!.y,0);
      expect(primary!.height).toBeCloseTo(clear!.height,0);
      expect(primary!.height).toBeGreaterThanOrEqual(52);
      expect(primary!.width).toBeGreaterThan(clear!.width);
      expect(clear!.x+clear!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
      if(width>380 && width<=760) {
        const structure = await page.locator('#aircraft').boundingBox();
        const stator = await page.locator('#stator').boundingBox();
        expect(structure!.y).toBeCloseTo(stator!.y,0);
      }
    }
    await page.setViewportSize({width:390,height:844});await fill(page);
    await page.getByRole('button',{name:'评估本次飞行',exact:true}).click();
    const expected=parity.cases.find((c:{aircraft:string;style:string})=>c.aircraft==='quad' && c.style==='cruise');
    await expect(page.locator('.estimate-time')).toContainText(expected.range[0].toFixed(2));
    await page.getByRole('button',{name:'清空',exact:true}).click();
    await expect(page.locator('#weight')).toHaveValue('');await expect(page.locator('#weight')).toBeFocused();
    await expect(page.locator('.estimate-time')).toHaveCount(0);
  } finally { await context.close(); }
});

test('Windows保留定子说明、按钮箭头和原按钮尺寸', async ({page}) => {
  await expect(page.locator('label[for="stator"] .optional-tag')).toHaveText('未知可跳过候选');
  await expect(page.locator('.actionbar .primary span')).toHaveText('↗');
  await expect(page.locator('.app-shell')).not.toHaveClass(/android-app/);
  expect((await page.locator('.actionbar .primary').boundingBox())!.height).toBe(48);
});

test('手机竖横屏与桌面使用同一domain结果，八种结构工况完整对比', async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await fill(page);
  for (const [structure, aircraft, retention] of [['quad','quad','25'],['whoop','whoop','18']] as const) {
    await page.locator('#aircraft').selectOption(structure);
    for (const [style,scenario] of Object.entries(flightScenarios)) {
      await page.getByRole('radio',{name:scenario.label,exact:true}).check();
      const expected=parity.cases.find((c: {aircraft:string;style:string})=>c.aircraft===aircraft && c.style===style);
      await page.getByRole('button',{name:'评估本次飞行'}).click();
      await expect(page.locator('.estimate-time')).toContainText(expected.range[0].toFixed(2));
      await expect(page.locator('.comparison-summary')).toHaveText(expected.comparison);
      const position=await page.locator('.result-panel').boundingBox();
      expect(position!.y).toBeGreaterThanOrEqual(-1);expect(position!.y).toBeLessThan(200);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    }
  }
  const old=await page.locator('.estimate-time').textContent();
  for(const [width,height] of [[844,390],[360,740],[320,640],[1240,900]]) {
    await page.setViewportSize({width,height});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await expect(page.locator('#weight')).toHaveValue('650.5');
    await expect(page.locator('.estimate-time')).toHaveText(old!);
  }
  await page.locator('#minutes').fill('9');await expect(page.locator('.estimate-time')).toHaveCount(0);
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.estimate-time')).toHaveText(old!);
});

test('手机未知快捷键、负温度、明确0、非法定位和重载不保存', async ({page}) => {
  await page.setViewportSize({width:360,height:740}); await fill(page);
  await page.getByRole('button',{name:'落地后多久测量上述电压设为未知'}).click();
  await expect(page.locator('#landingDelay')).toHaveValue('未知');
  await page.locator('.optional-section>summary').click();
  await expect(page.locator('#temperature')).toHaveAttribute('inputmode','text');
  await page.locator('#temperature').fill('-10.5');await page.locator('#roughAuxPower').fill('0');
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.estimate-time')).toBeVisible();
  await page.getByRole('button',{name:'假设辅助功耗设为未知'}).click();await expect(page.locator('.estimate-time')).toHaveCount(0);
  await expect(page.locator('#roughAuxPower')).toHaveValue('未知');await page.locator('#roughAuxPower').fill('');await expect(page.locator('#roughAuxPower')).toHaveValue('');
  await page.locator('#cells').fill('0');await page.getByRole('button',{name:'评估本次飞行'}).click();
  await expect(page.locator('#cells')).toBeFocused();await expect(page.locator('#cells')).toHaveAttribute('aria-invalid','true');
  await page.reload();await expect(page.locator('#weight')).toHaveValue('');
});
