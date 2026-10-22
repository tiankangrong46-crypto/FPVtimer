import { test, expect, type Page } from '@playwright/test';
const fields = {weight:'650.5',wheelbase:'225',kv:'1750',diameter:'5.1',pitch:'3.5',blades:'3',capacity:'1300',cells:'6',minutes:'4',seconds:'30',startVoltage:'25.200',endVoltage:'22.200'};
async function fill(page:Page) { for (const [id,value] of Object.entries(fields)) await page.locator(`#${id}`).fill(value); }
test.beforeEach(async ({page}) => { await page.goto('http://127.0.0.1:1420'); await page.getByRole('radio',{name:'标准评估',exact:true}).check(); });

test('已选定的logo在桌面和窄屏加载完整，浏览器图标可离线读取',async({page})=>{
  const logo=page.getByRole('img',{name:'FPV Endurance 标志'});
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth===1254&&img.naturalHeight===1254)).toBeTruthy();
  const favicon=page.locator('link[rel="icon"]');
  const iconUrl=await favicon.evaluate((link:HTMLLinkElement)=>link.href);
  const response=await page.request.get(iconUrl);expect(response.ok()).toBeTruthy();expect(response.headers()['content-type']).toContain('image/png');
  for(const width of [1240,760,390]){
    await page.setViewportSize({width,height:900});await expect(logo).toBeVisible();
    const box=await logo.boundingBox();expect(box?.width).toBe(44);expect(box?.height).toBe(44);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  }
});

test('手写字体离线加载，新标题完整，长规则默认折叠',async({page})=>{
  await page.reload();
  await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('h1')).toHaveText('地球开始竖着转了，朋友们我们赤道大变了');
  expect(await page.evaluate(async()=>(await document.fonts.load('16px "FPV WenKai"')).some(f=>f.status==='loaded'))).toBeTruthy();
  await expect(page.locator('.mode-picker>.small-note')).toHaveCount(0);
  await expect(page.locator('#aircraft').locator('..')).not.toContainText('最终时间×');
  await expect(page.locator('#aircraft').locator('..')).toContainText('切换结构会恢复对应的默认参数');
  await expect(page.locator('.model-guide>div')).not.toBeVisible();
  for(const width of [1240,760,390]){
    await page.setViewportSize({width,height:900});
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  }
  await page.locator('.model-guide>summary').click();
  await expect(page.locator('.model-guide>div')).toBeVisible();
  await expect(page.locator('.model-guide')).toContainText('花飞58%');
  await expect(page.locator('.model-guide')).toContainText('竞速33%');
  await page.locator('.model-guide>summary').click();
  await expect(page.locator('.model-guide>div')).not.toBeVisible();
});

test('机架最大桨径限制用英寸，轴距仍为mm，超限只跳过理论参考',async({page})=>{
  await fill(page);await page.locator('#stator').fill('2306');await page.locator('#kv').fill('1850');await page.getByRole('radio',{name:'粗估模式',exact:true}).check();
  await page.locator('#frameMaxProp').fill('5');await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.result-reason')).toContainText('5.1英寸超过');await expect(page.locator('.estimate-time')).toHaveCount(0);
  await page.locator('#frameMaxProp').fill('5.1');await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.estimate-time')).toContainText('分钟');
  await page.locator('#frameMaxProp').fill('未知');await expect(page.locator('.estimate-time')).toHaveCount(0);await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.estimate-time')).toContainText('分钟');
  await page.locator('.rough-results>summary').click();await expect(page.locator('.rough-results')).toContainText('未核实安装适配');
  await page.locator('.frame-size-reference>summary').click();await expect(page.locator('.frame-size-reference')).toContainText('225 mm机架示例：5.1 英寸桨');
  await expect(page.locator('#wheelbase').locator('..')).toContainText('mm');await expect(page.locator('#diameter').locator('..')).toContainText('英寸');
});

test('默认理论模式，两结构四工况最终时间及实际对比',async({page})=>{
  await page.reload();await expect(page.getByRole('radio',{name:'粗估模式',exact:true})).toBeChecked();
  await fill(page);await page.locator('#stator').fill('2306');await page.locator('#kv').fill('1850');
  for(const structure of ['quad','whoop']){
    await page.locator('#aircraft').selectOption(structure);let hover=0;
    for(const [label,factor] of [['悬停',1],['巡航',0.8],['花飞',0.58],['竞速',0.33]] as const){
      await page.getByRole('radio',{name:label,exact:true}).check();await expect(page.locator('.estimate-time')).toHaveCount(0);
      await page.getByRole('button',{name:'评估本次飞行'}).click();const time=parseFloat((await page.locator('.estimate-time').textContent())!);
      if(factor===1)hover=time;expect(Math.abs(time-hover*factor)).toBeLessThanOrEqual(0.011);
      await expect(page.locator('.reference-time')).toContainText(`${label}理论参考时间`);await expect(page.locator('.actual-time')).toContainText('4.50');
      if(label==='花飞')await expect(page.locator('.rough-results')).toContainText('花飞时间系数58%（用户指定假设）');
      await expect(page.locator('.comparison-summary')).toContainText('实际－参考');await expect(page.locator('.assessment-note')).toContainText('未经实机校准');await expect(page.locator('.interval-note')).toContainText('使用区间可能不同');
    }
  }
  const base=await page.locator('.estimate-time').textContent();await page.locator('#minutes').fill('50');await page.getByRole('button',{name:'评估本次飞行'}).click();
  expect(await page.locator('.estimate-time').textContent()).toBe(base);await expect(page.locator('.comparison-summary')).toContainText('比参考长');
  await page.locator('.optional-section>summary').click();await page.locator('#comparisonConditions').selectOption('early');await page.getByRole('button',{name:'评估本次飞行'}).click();
  await expect(page.locator('.interval-note')).toContainText('提前落地');expect(await page.locator('.estimate-time').textContent()).toBe(base);
  await page.getByRole('button',{name:'清空',exact:true}).click();await expect(page.locator('#aircraft')).toHaveValue('quad');await expect(page.locator('#roughStructurePercent')).toHaveValue('25');await expect(page.locator('.comparison-summary')).toHaveCount(0);
});

test('主表单圈圈45%假设与结构联动且不复用裸桨台架', async ({page}) => {
  await fill(page);await page.locator('#stator').fill('2306');await page.locator('#kv').fill('1850');
  await page.getByRole('radio',{name:'粗估模式',exact:true}).check();
  await expect(page.locator('#aircraft')).toHaveValue('quad');
  await page.locator('.optional-section>summary').click();
  await page.locator('#roughStructurePercent').fill('10');
  for(const structure of ['whoop']) {
    await page.locator('#aircraft').selectOption(structure);await expect(page.locator('#roughStructurePercent')).toHaveValue('18');
    await page.getByRole('button',{name:'评估本次飞行'}).click();
    await expect(page.locator('.result-state')).toHaveText('理想模型粗估');await expect(page.locator('.estimate-time')).toContainText('分钟');
    await expect(page.locator('.result-reason')).toContainText('结构时间×0.18（假设）');await expect(page.locator('.rating')).toHaveCount(0);
    await page.locator('#roughStructurePercent').fill('14');await expect(page.locator('.estimate-time')).toHaveCount(0);
  }
  await page.locator('#aircraft').selectOption('quad');await expect(page.locator('#roughStructurePercent')).toHaveValue('25');
  await expect(page.locator('#aircraft option')).toHaveText(['裸桨','圈圈']);
  await page.getByRole('button',{name:'清空',exact:true}).click();await expect(page.locator('#aircraft')).toHaveValue('quad');await expect(page.locator('#roughStructurePercent')).toHaveValue('25');
});
test('必填校验、焦点与单位', async ({page}) => {
  await page.getByRole('button',{name:'评估本次飞行'}).click();
  await expect(page.getByRole('alert')).toContainText('必填数据需要修正');
  await expect(page.locator('#weight')).toBeFocused();
  await expect(page.getByText('机架对角电机轴距，不是桨径')).toBeVisible();
});
test('完整基础评估、未知选填、修改后结果失效', async ({page}) => {
  await fill(page); await page.getByRole('button',{name:'评估本次飞行'}).click();
  await expect(page.locator('.rating')).toHaveText('参考不足');
  await expect(page.locator('.reference-time')).toContainText('暂无可靠范围');
  await expect(page.locator('.optional-results')).toHaveCount(0);
  await page.locator('#weight').fill('651'); await expect(page.locator('.rating')).toHaveCount(0);
});
test('已知选填计算、未知只跳过、非法可选不阻止', async ({page}) => {
  await fill(page); await page.locator('.optional-section>summary').click();
  await page.locator('#resistance').fill('3.5'); await page.locator('#resistanceMethod').selectOption('charger');
  await page.locator('#resistanceDevice').fill('人工测试设备'); await page.locator('#current').fill('15');
  await page.locator('#currentSource').selectOption('calibrated-flight');
  await page.locator('#loadedVoltage').fill('21.000'); await page.locator('#beforeStop').fill('0.5');
  await page.locator('#afterStop').fill('2'); await page.locator('#paired').selectOption('yes');
  await page.getByRole('button',{name:'评估本次飞行'}).click();
  await expect(page.locator('.optional-results')).toContainText('0.315 V');
  await expect(page.locator('.optional-results')).toContainText('+1.200 V');
  await page.locator('#beforeStop').fill('未知'); await page.locator('#resistance').fill('3.55');
  await page.getByRole('button',{name:'评估本次飞行'}).click();
  await expect(page.locator('.rating')).toHaveText('参考不足'); await expect(page.locator('.optional-results')).toHaveCount(0);
  await expect(page.locator('.warning-box')).toContainText('最多 1 位小数');
});
test('八节与电压精度边界、清空后不留结果', async ({page}) => {
  await fill(page); await page.locator('#cells').fill('9'); await page.getByRole('button',{name:'评估本次飞行'}).click();
  await expect(page.locator('#cells')).toHaveAttribute('aria-invalid','true');
  await page.locator('#cells').fill('8'); await page.locator('#startVoltage').fill('33.600'); await page.locator('#endVoltage').fill('29.600');
  await page.getByRole('button',{name:'评估本次飞行'}).click(); await expect(page.locator('.rating')).toHaveText('参考不足');
  await page.getByRole('button',{name:'清空',exact:true}).click(); await expect(page.locator('#weight')).toHaveValue('');
  await expect(page.locator('.rating')).toHaveCount(0);
});
test('厂商标称不可作为实测、无运行时外部请求', async ({page}) => {
  const external:string[]=[];
  page.on('request',r=>{if (!r.url().startsWith('http://127.0.0.1:1420')) external.push(r.url());});
  await page.reload(); await fill(page); await page.getByRole('button',{name:'评估本次飞行'}).click();
  await page.locator('.explanation>summary').filter({hasText:'参考库与适用边界'}).click();
  await expect(page.locator('.library-note')).toContainText('0 条'); expect(external).toEqual([]);
});
test('窄窗口无水平溢出', async ({page}) => {
  await page.setViewportSize({width:760,height:700});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});

async function fillTarget(page:Page){
  await page.locator('.analysis-fold>summary').filter({hasText:'目标可用容量'}).click();
  for(const [id,value] of Object.entries({availableCapacity:'1000',capacityNote:'人工验收明确假设，非真实参考',availableEnergy:'12',energyNote:'人工验收能量假设，非实测精度证明',targetStartVoltage:'25.2',targetEndVoltage:'22.2',targetIntervalNote:'人工验收：停桨区间、时点与负载条件已说明'}))await page.locator(`#${id}`).fill(value);
  await page.locator('#capacityBasis').selectOption('assumed');await page.locator('#energyBasis').selectOption('assumed');
  await page.locator('#targetVoltageState').selectOption('rest');await page.locator('#targetApplies').selectOption('yes');
}
test('本次等效续航有标签，不能自证正常；容量未知时降级',async({page})=>{
  await fill(page);await page.locator('.optional-section>summary').click();
  await page.locator('#current').fill('15');await page.locator('#currentSource').selectOption('calibrated-flight');
  await fillTarget(page);await page.getByRole('button',{name:'评估本次飞行'}).click();
  await expect(page.locator('.result-state')).toHaveText('等效续航');await expect(page.locator('.reference-time')).toContainText('4.00 分钟');
  await expect(page.locator('.rating')).toHaveCount(0);await expect(page.locator('.assessment-note')).toContainText('不构成独立理论参考');await expect(page.locator('.estimate-time')).toContainText('4.00');
  await page.locator('#availableCapacity').fill('未知');await page.getByRole('button',{name:'评估本次飞行'}).click();
  await expect(page.locator('.reference-time')).toContainText('暂无可靠范围');
});
test('台架模型→缺工况k降级等效→电流未知降级参考不足',async({page})=>{
  await fill(page);await page.locator('#weight').fill('1200');await page.locator('#propModel').fill('TEST prop');
  await page.getByRole('radio',{name:'悬停',exact:true}).check();await page.locator('.optional-section>summary').click();
  await page.locator('#wind').selectOption('calm');await page.locator('#aircraft').selectOption('quad');
  await page.locator('#current').fill('15');await page.locator('#currentSource').selectOption('calibrated-flight');await fillTarget(page);
  await page.locator('.analysis-fold>summary').filter({hasText:'电机＋桨叶台架模型'}).click();
  await page.locator('#motor').fill('TEST motor');
  for(const[id,value]of Object.entries({benchMotor:'TEST motor',benchKv:'1750',benchPropModel:'TEST prop',benchVersion:'TEST-1',benchVoltage:'25.2',benchSource:'人工验收夹具，不是真实台架',benchConditions:'人工数据同一测试电压',benchData:'200,40\n300,70\n400,110',auxPower:'10',auxNote:'人工验收辅助功耗假设'}))await page.locator(`#${id}`).fill(value);
  for(const[id,value]of Object.entries({benchGroup:'open',benchAssembly:'isolated',benchThrustUnit:'gf',benchIncludesEsc:'yes',benchMatches:'yes',auxBasis:'assumed'}))await page.locator(`#${id}`).selectOption(value);
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.result-state')).toHaveText('模型粗估');await expect(page.locator('.reference-time')).toContainText('2.48 分钟');
  await page.getByRole('radio',{name:'巡航',exact:true}).check();await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.result-state')).toHaveText('等效续航');
  await page.locator('#currentSource').selectOption('unknown');await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.result-state')).toHaveText('参考不足');
});
test('回弹解释需要额外条件确认',async({page})=>{
  await fill(page);await page.locator('.optional-section>summary').click();
  for(const[id,value]of Object.entries({loadedVoltage:'21',beforeStop:'0.5',afterStop:'2'}))await page.locator(`#${id}`).fill(value);
  await page.locator('#paired').selectOption('yes');await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.optional-results')).toContainText('非回弹结论');
  await page.locator('#recoveryConditions').selectOption('negligible');await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.optional-results')).toContainText('条件已确认');
});

async function fillCategory(page:Page) {
  await fill(page);
  for (const [id,value] of Object.entries({stator:'0702',kv:'23000',weight:'40',wheelbase:'65',diameter:'1.2',pitch:'1.9',blades:'3',cells:'1',capacity:'300',startVoltage:'4.2',endVoltage:'3.7'})) await page.locator(`#${id}`).fill(value);
  await page.getByRole('radio',{name:'悬停',exact:true}).check();
  await page.locator('.optional-section>summary').click();
  await page.locator('#aircraft').selectOption('quad');await page.locator('#wind').selectOption('calm');
}
test('匿名真实候选离线展示、保留测试电压与ID、不生成续航或评级',async({page})=>{
  await fillCategory(page);await page.getByRole('button',{name:'评估本次飞行'}).click();
  await page.locator('.category-results>summary').click();
  await expect(page.locator('.candidate-row').first()).toContainText('测试 4 V');
  await expect(page.locator('.candidate-row').first()).toContainText('约 6.19 W');
  await expect(page.locator('.category-results')).toContainText('segment-f8ffeb9d6a64597e72c8');
  await expect(page.locator('.category-results')).toContainText('电调是否计入、装配、温度均未知');
  await expect(page.locator('.rating')).toHaveText('参考不足');await expect(page.locator('.reference-time')).toContainText('暂无可靠范围');
  // Legal attribution may contain URLs; anonymous candidate business rows must not.
  await expect(page.locator('.category-results')).not.toContainText('https://');
  await page.locator('#kv').fill('23000.1');await expect(page.locator('.rating')).toHaveCount(0);
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.candidate-row')).toHaveCount(0);
});
test('2306/1850无匹配且允许自由输入，不要求品牌',async({page})=>{
  await fill(page);await page.locator('#stator').fill('2306');await page.locator('#kv').fill('1850');
  await expect(page.locator('.coverage-note')).toContainText('暂无匹配候选');
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.rating')).toHaveText('参考不足');
  await page.locator('.category-results>summary').click();await expect(page.locator('.category-message')).toContainText('暂无匹配候选');
  await page.locator('#stator').fill('9909');await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.rating')).toHaveText('参考不足');
});
test('精确库内几何选择不舍入，切换回手填不丢原始字符串',async({page})=>{
  await fill(page);await page.locator('#libraryGeometry').selectOption('1.22|1|3');
  await expect(page.locator('#diameter')).toBeDisabled();await expect(page.locator('#diameter')).toHaveValue('5.1');
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.rating')).toHaveText('参考不足');
  await expect(page.locator('#libraryGeometry')).toHaveValue('1.22|1|3');
  await page.locator('#libraryGeometry').selectOption('');await expect(page.locator('.rating')).toHaveCount(0);
  await expect(page.locator('#diameter')).toBeEnabled();await expect(page.locator('#diameter')).toHaveValue('5.1');
});
test('有候选时等效继续工作，切换巡航只跳过候选功率',async({page})=>{
  await fillCategory(page);await page.locator('#current').fill('15');await page.locator('#currentSource').selectOption('calibrated-flight');await fillTarget(page);
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.result-state')).toHaveText('等效续航');
  await page.getByRole('radio',{name:'巡航',exact:true}).check();await page.getByRole('button',{name:'评估本次飞行'}).click();
  await expect(page.locator('.result-state')).toHaveText('等效续航');await expect(page.locator('.reference-time')).toContainText('4.00 分钟');
  await page.locator('.category-results>summary').click();await expect(page.locator('.category-message')).toContainText('工况或类别依据不足');await expect(page.locator('.candidate-row')).toHaveCount(0);
});

test('粗估模式突出标称能量场景时间与假设，不产生评级',async({page})=>{
  await fillCategory(page);await page.getByRole('radio',{name:'粗估模式',exact:true}).check();
  await page.getByRole('button',{name:'评估本次飞行'}).click();
  await expect(page.locator('.result-state')).toHaveText('标称能量等效');await expect(page.locator('.estimate-time')).toContainText('分钟');
  await expect(page.locator('.result-reason')).toContainText('假设标称能量全部可用');await expect(page.locator('.result-reason')).toContainText('仅计推进功耗');
  await expect(page.locator('.rating')).toHaveCount(0);await expect(page.locator('.assessment-note')).toContainText('未经实机校准');
  await page.locator('.rough-results>summary').click();await expect(page.locator('.rough-scenario').first()).toContainText('测试 4 V');
  await expect(page.locator('.rough-results')).toContainText('segment-f8ffeb9d6a64597e72c8');await expect(page.locator('.rough-results')).toContainText('电调计入、装配、温度仍未知');
  await page.getByRole('radio',{name:'标准评估',exact:true}).check();await expect(page.locator('.estimate-time')).toHaveCount(0);
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.rating')).toHaveText('参考不足');
});
test('可用比例与辅助明确生效，方式仅在时间最后修正',async({page})=>{
  await fillCategory(page);await page.getByRole('radio',{name:'粗估模式',exact:true}).check();
  await page.locator('#roughCapacityPercent').fill('80');await page.locator('#roughAuxPower').fill('5');
  await page.getByRole('button',{name:'评估本次飞行'}).click();const hover=await page.locator('.estimate-time').textContent();
  await expect(page.locator('#roughPowerMultiplier')).toHaveCount(0);await expect(page.locator('.result-reason')).toContainText('辅助5W');
  await page.getByRole('radio',{name:'巡航',exact:true}).check();await expect(page.locator('.estimate-time')).toHaveCount(0);
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.reference-time')).toContainText('巡航理论参考时间');
  expect(await page.locator('.estimate-time').textContent()).not.toBe(hover);await expect(page.locator('.result-reason')).toContainText('时间×0.8');
});

test('粗估比例零值不退回全部能量；无候选可走理想后备',async({page})=>{
  await fillCategory(page);await page.getByRole('radio',{name:'粗估模式',exact:true}).check();await page.locator('#roughCapacityPercent').fill('0');
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.rating')).toHaveText('暂无法估算');await expect(page.locator('.estimate-time')).toHaveCount(0);
  await expect(page.locator('.warning-box')).toContainText('必须大于 0');
  await page.locator('#roughCapacityPercent').fill('未知');await page.locator('#stator').fill('2306');await page.locator('#kv').fill('1850');
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.result-state')).toHaveText('理想模型粗估');await expect(page.locator('.estimate-time')).toContainText('分钟');
});
test('本次电流与实际时长不参与理论时间，比较独立变化',async({page})=>{
  await fillCategory(page);await page.getByRole('radio',{name:'粗估模式',exact:true}).check();
  await page.getByRole('button',{name:'评估本次飞行'}).click();const base=await page.locator('.estimate-time').textContent();
  await page.locator('#current').fill('3');await page.locator('#currentSource').selectOption('calibrated-flight');await page.locator('#minutes').fill('50');
  await page.getByRole('button',{name:'评估本次飞行'}).click();expect(await page.locator('.estimate-time').textContent()).toBe(base);
  await expect(page.locator('.actual-time')).toContainText('50.50');await expect(page.locator('.comparison-summary')).toContainText('达到参考');
});

test('LiHV标称值未知跳过能量粗估，按标签选择后可计算',async({page})=>{
  await fillCategory(page);await page.getByRole('radio',{name:'粗估模式',exact:true}).check();await page.locator('#chemistry').selectOption('LiHV');
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.rating')).toHaveText('暂无法估算');
  await page.locator('#roughNominalVoltage').selectOption('3.85');await page.getByRole('button',{name:'评估本次飞行'}).click();
  await expect(page.locator('.result-state')).toHaveText('标称能量等效');await expect(page.locator('.estimate-time')).toContainText('分钟');
  await page.locator('.rough-results>summary').click();await expect(page.locator('.rough-results')).toContainText('3.85V/节');
});

test('2306/1850无匹配使用理想模型；损耗假设改变时间并清除旧结果',async({page})=>{
  await fillCategory(page);await page.getByRole('radio',{name:'粗估模式',exact:true}).check();await page.locator('#stator').fill('2306');await page.locator('#kv').fill('1850');
  await expect(page.locator('#roughStructurePercent')).toHaveValue('25');await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.result-state')).toHaveText('理想模型粗估');await expect(page.locator('.result-reason')).toContainText('结构时间×0.25（假设）');
  await expect(page.locator('.rating')).toHaveCount(0);const ideal=await page.locator('.estimate-time').textContent();
  await page.locator('.rough-results>summary').click();await expect(page.locator('.ideal-scenario')).toContainText('理想诱导功率');await expect(page.locator('.ideal-scenario')).toContainText('1.225');
  await page.locator('#roughStructurePercent').fill('10');await expect(page.locator('.estimate-time')).toHaveCount(0);
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.result-reason')).toContainText('结构时间×0.1（假设）');expect(await page.locator('.estimate-time').textContent()).not.toBe(ideal);
  await page.locator('#roughStructurePercent').fill('101');await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.rating')).toHaveText('暂无法估算');await expect(page.locator('.warning-box')).toContainText('0至100%');
});
test('有匹配台架不再叠加理想损耗，未知原始条件保留',async({page})=>{
  await fillCategory(page);await page.getByRole('radio',{name:'粗估模式',exact:true}).check();await page.getByRole('button',{name:'评估本次飞行'}).click();
  const base=await page.locator('.estimate-time').textContent();await page.locator('#roughStructurePercent').fill('10');await page.getByRole('button',{name:'评估本次飞行'}).click();
  await expect(page.locator('.result-state')).toHaveText('标称能量等效');expect(await page.locator('.estimate-time').textContent()).toBe(base);
  await page.locator('.rough-results>summary').click();await expect(page.locator('.ideal-scenario')).toHaveCount(0);await expect(page.locator('.rough-results')).toContainText('不再叠加');await expect(page.locator('.rough-results')).toContainText('温度仍未知');
});
test('理想模型拒绝桨盘重叠，已有台架区间外也不绕过',async({page})=>{
  await fillCategory(page);await page.getByRole('radio',{name:'粗估模式',exact:true}).check();await page.locator('#stator').fill('2306');await page.locator('#kv').fill('1850');await page.locator('#diameter').fill('5');
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.rating')).toHaveText('暂无法估算');await expect(page.locator('.result-reason')).toContainText('重叠');
  await page.locator('#stator').fill('0702');await page.locator('#kv').fill('23000');await page.locator('#diameter').fill('1.2');await page.locator('#weight').fill('100000');
  await page.getByRole('button',{name:'评估本次飞行'}).click();await expect(page.locator('.rating')).toHaveText('暂无法估算');await expect(page.locator('.result-reason')).toContainText('不绕过');
});
