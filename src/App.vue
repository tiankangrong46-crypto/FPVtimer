<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import MeasureField from './MeasureField.vue';
import appLogo from './assets/app-logo.png';
import { blankInput, type Analysis, type RawInput, type NumberField, type Validation } from './domain/types';
import { labels, parseReading, validate } from './domain/validation';
import { analyze } from './domain/analysis';
import { referenceLibrary } from './data/reference-library';
import { geometryChoices, geometryKey, motorCoverage } from './domain/category-bench';
import { parseStator } from './domain/stator';
import { frameSizeExamples } from './domain/frame-fit';
import { selectStructure, structureOptions, structureValue } from './domain/structure';
import { comparisonSummary, comparisonIntervalNote, flightScenarios } from './domain/flight-scenario';
import { version } from '../package.json';
import fontLicense from './assets/fonts/OFL.txt?raw';

const isAndroid = /Android/i.test(navigator.userAgent);
const platformName = isAndroid ? 'Android' : 'Windows';
const form = reactive(blankInput());
const aircraftStructure = computed({ get: () => structureValue(form), set: value => Object.assign(form, selectStructure(value)) });
const validation = ref<Validation | null>(null);
const result = ref<Analysis | null>(null);
const submitted = ref(false);
const optionalOpen = ref(false);
const resultElement = ref<HTMLElement | null>(null);
const errors = computed(() => validation.value?.errors ?? []);
const optionalIssues = computed(() => validation.value?.optionalIssues ?? []);
const warnings = computed(() => [...(validation.value?.warnings ?? []), ...optionalIssues.value.map(i => i.message)]);
const estimateIsPrimary = computed(() => !!result.value && result.value.rating === '参考不足' && (result.value.timeMinutes !== null || result.value.timeRangeMinutes !== null));
const theoryTimeText = computed(() => {
  const range = result.value?.roughEstimate?.rangeMinutes;
  if (!range) return '';
  const [a,b] = range.map(t=>t.toFixed(2));return `${a===b?a:`${a}–${b}`} 分钟`;
});
const intervalNote = computed(() => validation.value?.input ? comparisonIntervalNote(validation.value.input) : '');
const timeText = computed(() => {
  const r = result.value; if (!r) return '';
  if (r.timeRangeMinutes) { const [a,b] = r.timeRangeMinutes.map(n=>n.toFixed(2)); return `${a===b ? a : `${a}–${b}`} 分钟`; }
  return r.timeMinutes === null ? '暂无可靠范围' : `${r.timeMinutes.toFixed(2)} 分钟`;
});
const motorCategories = referenceLibrary.available ? referenceLibrary.motors : [];
const statorOptions = [...new Set(motorCategories.map(m => m.stator))];
const kvOptions = computed(() => motorCategories.filter(m => m.stator === form.stator.trim()).map(m => m.kv));
const geometryOptions = geometryChoices();
const coverageNote = computed(() => {
  if (!referenceLibrary.available) return referenceLibrary.message;
  const stator = parseStator(form.stator), kv = parseReading(form.kv);
  if (stator.kind !== 'value' || kv.kind !== 'value') return '填写定子规格＋KV可查看覆盖；允许自由输入，未知不阻止基础评估。';
  const c = motorCoverage(stator.value, kv.value);
  return c ? `该规格／KV有 ${c.anonymousCurves} 个匿名组、${c.constantVoltageSegments} 段同电压候选；还需精确匹配桨叶、节数及工况。数量不是独立样本量。` : `${stator.value} / ${kv.value} KV 暂无匹配候选；基础评估仍可使用。`;
});
watch(form, () => { result.value = null; validation.value = null; submitted.value = false; }, { flush: 'sync' });
function errorFor(key: keyof RawInput) { return [...errors.value, ...optionalIssues.value].find(i => i.field === key)?.message; }
async function evaluate() {
  validation.value = validate({ ...form }); submitted.value = true;
  if (!validation.value.input) {
    result.value = null;
    const first = errors.value[0];
    if (first) { await nextTick(); document.getElementById(first.field)?.focus(); }
    return;
  }
  result.value = analyze(validation.value.input);
  await nextTick();
  if (window.matchMedia('(max-width: 760px)').matches) {
    (document.activeElement as HTMLElement | null)?.blur();
    resultElement.value?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  resultElement.value?.focus({ preventScroll: true });
}
async function reset() { Object.assign(form, blankInput()); optionalOpen.value = false; await nextTick(); document.getElementById('weight')?.focus(); }
const sourceOptions = [
  ['unknown', '未知'], ['calibrated-flight', '飞控／记录仪，已校准、同一飞行时段'],
  ['uncalibrated-flight', '飞控／记录仪，未校准或不清楚'], ['charger', '充电器（含回充量）'], ['other', '其他来源'],
];
const quantityOptions=[['unknown','未知'],['measured','独立测量'],['curve','适用电池曲线'],['assumed','明确假设（仅粗估）'],['this-flight','本次数据推算（不作独立可用量）']];
const groupOptions=[['unknown','未知'],['open','普通开放桨四轴'],['ducted','涵道四轴'],['whoop','Whoop（独立分组）']];
const planeFields: {key: NumberField; unit: string; hint?: string; integer?: boolean}[] = [
  {key:'weight',unit:'g',hint:'包含电池、相机及全部载荷'},
  {key:'wheelbase',unit:'mm',hint:'机架对角电机轴距，不是桨径'},
];
const propsFields: typeof planeFields = [
  {key:'diameter',unit:'英寸',hint:'桨叶直径；与机架轴距区分'},
  {key:'pitch',unit:'英寸',hint:'最多一位小数；也可填具体型号'},
  {key:'blades',unit:'片',integer:true,hint:'整数，例如 2 或 3'},
];
function timeRange(range: [number, number]) { return `${(range[0]/60).toFixed(1)}–${(range[1]/60).toFixed(1)} 分钟`; }
</script>

<template>
  <div class="app-shell" :class="{ 'android-app': isAndroid }">
    <header class="topbar">
      <div class="brand"><img class="brand-mark" :src="appLogo" alt="FPV Endurance 标志" width="44" height="44"><span>FIELD / FPV<span class="brand-sub">飞后参考工具</span></span></div>
      <span class="offline"><i></i> 本地运行 · 无需联网</span>
    </header>
    <main>
      <div class="intro">
        <div><p class="eyebrow">AFTER THE FLIGHT</p><h1>地球开始竖着转了，朋友们我们赤道大变了</h1><p class="intro-copy">查看所选工况的理论参考时间，并与本次实际时长比较。</p></div>
        <span class="version">{{ platformName }} · v{{ version }}</span>
      </div>
      <div class="scope-note">适用范围：普通四轴穿越机 · 1–8S LiPo / LiHV。续航偏短不能直接说明电池损坏。</div>
      <div class="workspace">
        <form novalidate autocomplete="off" @submit.prevent="evaluate" @keydown.ctrl.enter.prevent="evaluate">
          <fieldset class="style-picker mode-picker"><legend>评估模式</legend><div class="style-options"><label><input v-model="form.estimateMode" type="radio" name="estimate-mode" value="standard"><span>标准评估</span></label><label><input v-model="form.estimateMode" type="radio" name="estimate-mode" value="rough"><span>粗估模式</span></label></div></fieldset>
          <details class="model-guide"><summary>计算说明</summary><div><p>匹配台架优先，理想模型后备。飞行方式采用时间系数：{{ Object.values(flightScenarios).map(s => `${s.label}${Math.round(s.timeFactor * 100)}%`).join('、') }}，均为用户指定假设，未经实机校准。</p><p>结构时间保留参数：{{ structureOptions.map(s => `${s.label}${s.factorPercent}%`).join('、') }}。切换结构恢复默认值，仅用于理想模型；台架分支不重复折减。</p><p>标准评估保留独立实飞参考、严格台架和本次电流等效。详细条件见评估结果中的折叠依据。</p></div></details>
          <section class="form-section" aria-labelledby="plane-title">
            <div class="section-heading"><span class="step">01</span><h2 id="plane-title">飞机配置</h2><span class="section-meta">* 为必填项</span></div>
            <div class="grid two">
              <MeasureField v-for="f in planeFields" :key="f.key" :id="f.key" v-model="form[f.key]" :label="labels[f.key]" :unit="f.unit" :hint="f.hint" :error="errorFor(f.key)" required />
            </div>
            <div class="grid two">
              <div class="field"><label for="aircraft">飞机结构</label><select id="aircraft" v-model="aircraftStructure"><option v-for="s in structureOptions" :key="s.value" :value="s.value">{{ s.label }}</option></select><div class="field-hint">切换结构会恢复对应的默认参数。</div></div>
              <div class="field"><label for="stator">电机定子规格 <span v-if="!isAndroid" class="optional-tag">未知可跳过候选</span></label><input id="stator" v-model="form.stator" list="stator-options" maxlength="20" placeholder="例如0802、2306、2806.5；无需品牌" :aria-invalid="!!errorFor('stator')" aria-describedby="stator-hint"><datalist id="stator-options"><option v-for="s in statorOptions" :key="s" :value="s" /></datalist><div id="stator-hint" class="field-hint" :class="{'warning-text':errorFor('stator')}">{{ errorFor('stator') || '保留前导零和小数高度；可自由填写库外规格' }}</div></div>
            </div>
            <MeasureField id="frameMaxProp" v-model="form.frameMaxProp" label="机架允许最大桨径" unit="英寸" :error="errorFor('frameMaxProp')" soft unknown hint="选填，按你的机架说明书填写；超出上限停止理论估算。5英寸级可能允许5.1，以具体机架为准。" />
            <details class="frame-size-reference"><summary>机架轴距与桨径参考</summary><p>轴距用mm，桨径用英寸；下列是具体厂商配置示例，不能按轴距自动推定所有机架的上限。</p><p v-for="e in frameSizeExamples" :key="e.wheelbaseMm">{{ e.wheelbaseMm }} mm机架示例：{{ e.propellerIn }} 英寸桨。</p><p>未填写最大桨径时不确认安装适配；仍保留原几何模型范围检查。</p></details>
            <MeasureField id="kv" v-model="form.kv" label="电机 KV" unit="KV" :error="errorFor('kv')" required hint="按电机标注填写；同规格／KV不代表同款电机" list="kv-options" />
            <datalist id="kv-options"><option v-for="kv in kvOptions" :key="kv" :value="kv" /></datalist>
            <p class="coverage-note" role="status">{{ coverageNote }}</p>
            <div class="subheading">桨叶规格 <span>填写下方三项，或具体型号</span></div>
            <div class="grid three">
              <MeasureField v-for="f in propsFields" :key="f.key" :id="f.key" v-model="form[f.key]" :label="labels[f.key]" :unit="f.unit" :hint="f.hint" :integer="f.integer" :error="errorFor(f.key)" :disabled="!!form.libraryGeometry" :required="!form.propModel.trim() && !form.libraryGeometry" />
            </div>
            <div class="field"><label for="libraryGeometry">选择库内精确桨叶几何 <span class="optional-tag">选填</span></label><select id="libraryGeometry" v-model="form.libraryGeometry"><option value="">使用上方手填几何（最多一位小数）</option><option v-for="g in geometryOptions" :key="geometryKey(g)" :value="geometryKey(g)">{{ g.diameterIn }} × {{ g.pitchIn }} 英寸 · {{ g.blades }}叶</option></select><div class="field-hint">选择后替代手填几何，保留如1.22英寸的原值；几何相同不代表同款桨。</div></div>
            <div class="field"><label for="propModel">具体桨叶型号 <span class="optional-tag">可替代三项规格</span></label><input id="propModel" v-model="form.propModel" maxlength="120" placeholder="填写完整型号；不要把机架轴距填在这里"></div>
            <fieldset class="style-picker"><legend>本次飞行方式</legend><div class="style-options"><label v-for="s in Object.entries(flightScenarios).map(([key,value])=>[key,value.label])" :key="s[0]"><input v-model="form.style" type="radio" :value="s[0]" name="style"><span>{{ s[1] }}</span></label></div></fieldset>
          </section>
          <section class="form-section" aria-labelledby="battery-title">
            <div class="section-heading"><span class="step">02</span><h2 id="battery-title">电池规格</h2></div>
            <div class="grid three">
              <div class="field"><label for="chemistry">电池类型</label><select id="chemistry" v-model="form.chemistry"><option>LiPo</option><option>LiHV</option></select><div class="field-hint">本版不支持 Li-ion / LiFe</div></div>
              <MeasureField id="capacity" v-model="form.capacity" label="标称容量" unit="mAh" :error="errorFor('capacity')" required hint="按电池标签填写，不是本次消耗" />
              <MeasureField id="cells" v-model="form.cells" label="串联节数" unit="S" :error="errorFor('cells')" required integer hint="1–8 的整数" />
            </div>
          </section>
          <section class="form-section" aria-labelledby="flight-title">
            <div class="section-heading"><span class="step">03</span><h2 id="flight-title">本次飞行</h2><span class="section-meta">使用整包电压</span></div>
            <div class="grid two">
              <MeasureField id="minutes" v-model="form.minutes" label="实际飞行时间 · 分钟" unit="分" :error="errorFor('minutes')" required integer hint="整数；不足一分钟请填 0" />
              <MeasureField id="seconds" v-model="form.seconds" label="实际飞行时间 · 秒" unit="秒" :error="errorFor('seconds')" required integer hint="0–59；整分钟请填 0" />
              <MeasureField id="startVoltage" v-model="form.startVoltage" label="起飞前整包电压" unit="V" :error="errorFor('startVoltage')" required hint="停桨状态测量，最多三位小数" />
              <MeasureField id="endVoltage" v-model="form.endVoltage" label="落地停桨后整包电压" unit="V" :error="errorFor('endVoltage')" required hint="停桨状态测量，最多三位小数" />
            </div>
            <MeasureField id="landingDelay" v-model="form.landingDelay" label="落地后多久测量上述电压" unit="秒" :error="errorFor('landingDelay')" required hint="以落地为起点；不清楚可填“未知”" />
          </section>
          <details class="form-section optional-section" :open="optionalOpen" @toggle="optionalOpen = ($event.target as HTMLDetailsElement).open">
            <summary><span class="step">＋</span><span class="summary-text">可选电池分析<small>压降、回弹与测量条件；所有项允许未知</small></span><span class="chevron">⌄</span></summary>
            <div class="optional-content">
              <p class="small-note">空值、零与未知分别处理。依据不足只跳过对应分析，基本评估仍可使用。</p>
              <details class="analysis-fold rough-assumptions" :open="form.estimateMode==='rough'"><summary>粗估假设 <small>仅粗估模式采用；允许空值／未知，不是实测或独立校准</small></summary><div class="analysis-fold-body">
                <div class="grid two">
                  <MeasureField id="roughCapacityPercent" v-model="form.roughCapacityPercent" label="假设可用容量比例" unit="%" :error="errorFor('roughCapacityPercent')" soft unknown hint="大于0且不超过100%；未知时仅给假设标称能量全部可用的场景" />
                  <MeasureField id="roughAuxPower" v-model="form.roughAuxPower" label="假设辅助功耗" unit="W" :error="errorFor('roughAuxPower')" soft unknown hint="含图传等设备；未知时另给仅计推进功耗的场景，0是明确假设" />
                  <MeasureField id="roughStructurePercent" v-model="form.roughStructurePercent" label="结构时间保留系数（用户假设）" unit="%" :error="errorFor('roughStructurePercent')" soft unknown hint="裸桨25%，圈圈18%；最终时间直接乘此比例，不是减去此比例。可改／未知；0无法用于比较，台架不叠加。" />
                  <div v-if="form.chemistry==='LiHV'" class="field"><label for="roughNominalVoltage">LiHV标签标称单节电压</label><select id="roughNominalVoltage" v-model="form.roughNominalVoltage"><option value="unknown">未知／尚未核对标签</option><option value="3.8">标签为3.80 V／节</option><option value="3.85">标签为3.85 V／节</option></select><p class="field-hint">只用于标称能量；不是满充或存储电压。未知时不从容量推Wh。</p></div>
                </div>
                <p class="small-note">LiPo标称能量按3.7V／节计算。也可使用下方有依据的目标可用Wh／容量；有效目标量优先，比例不重复扣减。主表单选择飞机结构；涵道／圈圈机用理想桨盘基线＋用户时间系数假设，不套开放桨台架，未计算涵道增升或气流干扰。模型假设标准海平面、正方形布局和独立桨盘；超出范围仍停止。时间系数未经实机校准。</p>
              </div></details>
              <div class="grid two">
                <MeasureField id="resistance" v-model="form.resistance" label="平均单节内阻" unit="mΩ" :error="errorFor('resistance')" soft unknown hint="单节平均，支持 3.5；不是整包内阻" />
                <div class="field"><label for="resistanceMethod">内阻测量方式</label><select id="resistanceMethod" v-model="form.resistanceMethod"><option value="unknown">未知</option><option value="charger">充电器内阻读数</option><option value="dc">直流负载／脉冲测量</option><option value="ac">交流内阻仪（不用于压降）</option><option value="other">其他方式（不用于压降）</option></select></div>
              </div>
              <div class="field"><label for="resistanceDevice">内阻测量设备 <span class="optional-tag">选填</span></label><input id="resistanceDevice" v-model="form.resistanceDevice" maxlength="120" placeholder="设备型号；可填未知"><div class="field-hint">充电器读数受测量算法、连接、温度和荷电状态影响</div></div>
              <div class="grid two">
                <MeasureField id="current" v-model="form.current" label="平均电流" unit="A" :error="errorFor('current')" soft unknown hint="与上方计时对应的整次飞行平均值" />
                <div class="field"><label for="currentSource">平均电流来源</label><select id="currentSource" v-model="form.currentSource"><option v-for="s in sourceOptions" :key="s[0]" :value="s[0]">{{ s[1] }}</option></select></div>
                <MeasureField id="consumed" v-model="form.consumed" label="本次消耗电量" unit="mAh" :error="errorFor('consumed')" soft unknown hint="同一计时段的放电积分；回充量不替代放电量" />
                <div class="field"><label for="consumedSource">消耗电量来源</label><select id="consumedSource" v-model="form.consumedSource"><option v-for="s in sourceOptions" :key="s[0]" :value="s[0]">{{ s[1] }}</option></select></div>
              </div>
              <div class="field"><label for="sourceDetail">电流／电量测量设备与说明 <span class="optional-tag">选填</span></label><input id="sourceDetail" v-model="form.sourceDetail" maxlength="200" placeholder="可填设备型号、校准说明或未知"></div>
              <div class="field"><label for="comparisonConditions">本次与理论目标的电量区间／结束条件</label><select id="comparisonConditions" v-model="form.comparisonConditions"><option value="unknown">未知／尚未核对</option><option value="same">已核对：区间、测量状态及时机、结束条件一致</option><option value="different">电量区间或结束条件不同</option><option value="early">提前落地／未用完目标可用能量</option></select><p class="field-hint">仅用于比较说明，不调整理论时间；确认一致还需完整目标能量区间依据。</p></div>
              <div class="subheading">电压回弹 <span>仅比较同一次停桨前后的读数</span></div>
              <MeasureField id="loadedVoltage" v-model="form.loadedVoltage" label="落地前负载整包电压" unit="V" :error="errorFor('loadedVoltage')" soft unknown hint="仍有电机负载时的读数，不是起飞前电压" />
              <div class="grid two">
                <MeasureField id="beforeStop" v-model="form.beforeStop" label="负载读数距停桨多久" unit="秒前" :error="errorFor('beforeStop')" soft unknown hint="以电机停转为起点，填非负数或未知" />
                <MeasureField id="afterStop" v-model="form.afterStop" label="停桨后多久测量落地电压" unit="秒后" :error="errorFor('afterStop')" soft unknown hint="对应上方落地整包电压；与落地后间隔区分" />
              </div>
              <div class="field"><label for="paired">两次电压的测量条件</label><select id="paired" v-model="form.paired"><option value="unknown">未知／无法确认</option><option value="yes">同次停桨、同设备，期间未再飞行或充电</option><option value="no">不同事件、不同设备或期间再次飞行／充电</option></select></div>
              <div class="field"><label for="recoveryConditions">回弹解释所需的额外条件</label><select id="recoveryConditions" v-model="form.recoveryConditions"><option value="unknown">未知：只对照读数，不作回弹解释</option><option value="negligible">已核对：测量时点接近，期间电量变化可忽略</option><option value="not-negligible">时点不接近或期间电量变化不可忽略</option></select><div class="field-hint">程序不会凭空设定接近的秒数阈值；此确认应有日志或测量记录依据</div></div>
              <div class="grid two">
                <MeasureField id="temperature" v-model="form.temperature" label="环境温度" unit="°C" :error="errorFor('temperature')" soft unknown hint="允许负温度；未测量可填未知" />
                <div class="field"><label for="wind">风况</label><select id="wind" v-model="form.wind"><option value="unknown">未知</option><option value="calm">无明显风</option><option value="light">有轻风</option><option value="strong">风较大／阵风</option></select><div class="field-hint">仅记录条件，不套用经验修正系数</div></div>
              </div>
              <div class="grid two">
                <MeasureField id="startDelay" v-model="form.startDelay" label="起飞电压测量距起飞多久" unit="秒前" :error="errorFor('startDelay')" soft unknown hint="用于独立参考的测量时机匹配；允许未知" />
              </div>
              <details class="analysis-fold">
                <summary>目标可用容量／能量 <small>仅用于等效续航或台架模型，允许未知</small></summary>
                <div class="analysis-fold-body">
                  <p class="small-note">不是标称容量，也不默认取80%。Q用于“保持本次平均耗电强度的等效续航”；Wh用于独立台架模型。两者都需要明确目标区间与依据，不能把本次数据当成独立参考。</p>
                  <div class="grid two">
                    <MeasureField id="availableCapacity" v-model="form.availableCapacity" label="目标区间可用容量 Q" unit="mAh" :error="errorFor('availableCapacity')" soft unknown />
                    <div class="field"><label for="capacityBasis">可用容量依据</label><select id="capacityBasis" v-model="form.capacityBasis"><option v-for="o in quantityOptions" :key="o[0]" :value="o[0]">{{ o[1] }}</option></select></div>
                  </div>
                  <div class="field"><label for="capacityNote">容量来源／明确假设</label><input id="capacityNote" v-model="form.capacityNote" maxlength="500" placeholder="测量记录、曲线出处与适用条件，或明确写出假设；允许未知"></div>
                  <div class="grid two">
                    <MeasureField id="availableEnergy" v-model="form.availableEnergy" label="目标区间可用能量 E" unit="Wh" :error="errorFor('availableEnergy')" soft unknown />
                    <div class="field"><label for="energyBasis">可用能量依据</label><select id="energyBasis" v-model="form.energyBasis"><option v-for="o in quantityOptions" :key="o[0]" :value="o[0]">{{ o[1] }}</option></select></div>
                  </div>
                  <div class="field"><label for="energyNote">能量来源／明确假设</label><input id="energyNote" v-model="form.energyNote" maxlength="500" placeholder="独立Wh积分、适用曲线或明确假设；不能按起降电压差线性换算"></div>
                  <div class="grid two">
                    <MeasureField id="targetStartVoltage" v-model="form.targetStartVoltage" label="目标起点整包电压" unit="V" :error="errorFor('targetStartVoltage')" soft unknown />
                    <MeasureField id="targetEndVoltage" v-model="form.targetEndVoltage" label="目标终点整包电压" unit="V" :error="errorFor('targetEndVoltage')" soft unknown />
                    <div class="field"><label for="targetVoltageState">目标区间电压状态</label><select id="targetVoltageState" v-model="form.targetVoltageState"><option value="unknown">未知</option><option value="rest">停桨／静置电压</option><option value="load">负载电压</option></select></div>
                    <div class="field"><label for="targetApplies">目标可用量适用性</label><select id="targetApplies" v-model="form.targetApplies"><option value="unknown">未知／未核对</option><option value="yes">已核对适用于本电池及目标温度、负载</option><option value="no">不适用</option></select></div>
                  </div>
                  <div class="field"><label for="targetIntervalNote">区间测量时机、负载与截止条件</label><input id="targetIntervalNote" v-model="form.targetIntervalNote" maxlength="600" placeholder="说明起止读数时点、静置条件、放电电流和截止条件；允许未知"></div>
                </div>
              </details>
              <details class="analysis-fold">
                <summary>电机＋桨叶台架模型 <small>有原始台架数据时填写；不是正式评级</small></summary>
                <div class="analysis-fold-body">
                  <p class="small-note">只做覆盖范围内插值。所有行必须来自同一电机、桨叶与测试电压；功率须为含电调的电池侧电输入功率。公开表格尚未核实，不预填演示数据。</p>
                  <div class="grid two">
                    <div class="field"><label for="motor">飞机电机完整型号 <span class="optional-tag">仅人工精确台架使用</span></label><input id="motor" v-model="form.motor" maxlength="120" placeholder="仅有定子规格不能代替完整型号；允许未知"></div>
                    <div class="field"><label for="benchMotor">台架记录的电机完整型号</label><input id="benchMotor" v-model="form.benchMotor" maxlength="120" placeholder="须与飞机完整型号一致；允许未知"></div>
                    <MeasureField id="benchKv" v-model="form.benchKv" label="台架电机 KV" unit="KV" :error="errorFor('benchKv')" soft unknown />
                    <div class="field"><label for="benchPropModel">台架记录的桨叶完整型号</label><input id="benchPropModel" v-model="form.benchPropModel" maxlength="120" placeholder="须与飞机具体桨叶型号一致；允许未知"></div>
                    <MeasureField id="benchVoltage" v-model="form.benchVoltage" label="台架测试电压" unit="V" :error="errorFor('benchVoltage')" soft unknown />
                    <div class="field"><label for="benchGroup">台架类别／独立校准组</label><select id="benchGroup" v-model="form.benchGroup"><option v-for="g in groupOptions" :key="g[0]" :value="g[0]">{{ g[1] }}</option></select></div>
                    <div class="field"><label for="benchAssembly">台架装配状态</label><select id="benchAssembly" v-model="form.benchAssembly"><option value="unknown">未知</option><option value="isolated">独立裸电机＋桨叶</option><option value="installed">与对应机型一致的装配／涵道状态</option></select></div>
                    <div class="field"><label for="benchThrustUnit">台架推力单位</label><select id="benchThrustUnit" v-model="form.benchThrustUnit"><option value="unknown">未知</option><option value="gf">g推力（克力，不是N）</option><option value="N">N（牛顿）</option></select></div>
                    <div class="field"><label for="benchIncludesEsc">功率定义</label><select id="benchIncludesEsc" v-model="form.benchIncludesEsc"><option value="unknown">未知</option><option value="yes">含电调的电池侧电输入功率W</option><option value="no">轴功率或不含电调（不适用）</option></select></div>
                  </div>
                  <div class="field"><label for="benchData">台架表：每行“推力,电输入功率W”</label><textarea id="benchData" v-model="form.benchData" rows="5" maxlength="24000" placeholder="2–500行，无表头；允许未知。每列最多三位小数；不要混入不同电压的数据。" :aria-invalid="!!errorFor('benchData')"></textarea><div v-if="errorFor('benchData')" class="field-hint warning-text">{{ errorFor('benchData') }}</div></div>
                  <div class="grid two">
                    <div class="field"><label for="benchSource">台架来源</label><input id="benchSource" v-model="form.benchSource" maxlength="500" placeholder="原始记录、网址或文件编号；允许未知"></div>
                    <div class="field"><label for="benchVersion">数据版本／测量日期</label><input id="benchVersion" v-model="form.benchVersion" maxlength="120" placeholder="允许未知"></div>
                  </div>
                  <div class="field"><label for="benchConditions">台架测量条件与适用范围</label><input id="benchConditions" v-model="form.benchConditions" maxlength="600" placeholder="电压、环境、设备、装配及持续时间等；允许未知"></div>
                  <div class="field"><label for="benchMatches">台架适用性核对</label><select id="benchMatches" v-model="form.benchMatches"><option value="unknown">未知／未核对</option><option value="yes">已核对电机、桨叶、同测试电压及对应机型适用条件</option><option value="no">不匹配</option></select></div>
                  <div class="grid two">
                    <MeasureField id="auxPower" v-model="form.auxPower" label="图传和其他电子设备功耗" unit="W" :error="errorFor('auxPower')" soft unknown hint="不默认为0；0也要说明明确依据或假设" />
                    <div class="field"><label for="auxBasis">辅助功耗依据</label><select id="auxBasis" v-model="form.auxBasis"><option value="unknown">未知</option><option value="measured">测量值</option><option value="assumed">明确假设（粗估）</option></select></div>
                  </div>
                  <div class="field"><label for="auxNote">辅助功耗来源／假设说明</label><input id="auxNote" v-model="form.auxNote" maxlength="500" placeholder="允许未知"></div>
                  <p class="small-note">台架模型需要上方有依据的可用Wh。理论参考模式使用静态功率基线，再乘用户时间系数；标准评估仍只接受独立实测工况k，两者不叠加。</p>
                </div>
              </details>
            </div>
          </details>
          <div v-if="submitted && errors.length" role="alert" class="error-summary">有 {{ errors.length }} 项必填数据需要修正。已定位到第一项。</div>
          <div class="actionbar"><button type="submit" class="primary">评估本次飞行 <span v-if="!isAndroid" aria-hidden="true">↗</span></button><button type="button" class="reset" @click="reset">清空</button><span v-if="!isAndroid" class="shortcut">Ctrl + Enter</span></div>
          <p class="privacy-note">数据只在本次窗口内使用，关闭后不保留。</p>
        </form>

        <aside class="results-column">
          <div ref="resultElement" class="result-panel" tabindex="-1" aria-label="评估结果">
            <div class="result-top"><span class="eyebrow">FLIGHT ASSESSMENT</span><span class="result-state">{{ result ? result.kind : '待评估' }}</span></div>
            <template v-if="result">
              <template v-if="result.comparison && result.roughEstimate"><p class="result-label">{{ structureOptions.find(s=>s.value===aircraftStructure)?.label }} · {{ result.roughEstimate.styleLabel }}</p><div class="reference-time estimate-primary"><span>{{ result.roughEstimate.timeLabel }}</span><h2 class="estimate-time" aria-live="polite">{{ theoryTimeText }}</h2></div></template>
              <template v-else-if="estimateIsPrimary"><div class="reference-time estimate-primary"><span>{{ result.timeLabel }}</span><h2 class="estimate-time" aria-live="polite">{{ timeText }}</h2></div></template>
              <template v-else><p class="result-label">{{ form.estimateMode==='rough' && result.rating==='参考不足' ? '时间估算' : '续航表现' }}</p><h2 class="rating" aria-live="polite">{{ form.estimateMode==='rough' && result.rating==='参考不足' ? '暂无法估算' : result.rating }}</h2><div class="reference-time"><span>{{ result.timeLabel }}</span><strong>{{ timeText }}</strong></div></template>
              <p class="result-reason">{{ result.roughEstimate?.summary || result.reason }}</p>
              <template v-if="result.comparison && result.roughEstimate">
                <p class="actual-time">本次实际时间：<strong>{{ result.comparison.actualMinutes.toFixed(2) }} 分钟</strong></p>
                <p class="comparison-summary"><strong>{{ comparisonSummary(result.comparison) }}</strong></p>
                <p class="assessment-note">基于用户指定结构时间及飞行方式系数的理论情景，未经实机校准。</p>
                <p class="interval-note">{{ intervalNote }}</p>
                <p v-if="result.kind==='实测参考'" class="formal-rating">独立实飞参考评级：{{ result.rating }}。{{ result.reason }}</p>
              </template>
              <p v-else-if="estimateIsPrimary" class="assessment-note">本次等效信息不构成独立理论参考或正式评级。</p>
              <div v-if="result.sag || result.rebound" class="optional-results">
                <div v-for="d in [result.sag, result.rebound].filter(Boolean)" :key="d!.label" class="optional-result"><span>{{ d!.label }}</span><strong>{{ d!.value }}</strong><small>{{ d === result.sag ? '平均负载电阻项粗估，非峰值压降' : `停桨前 ${form.beforeStop} 秒 → 后 ${form.afterStop} 秒；非瞬时压降` }}</small></div>
              </div>
            </template>
            <template v-else>
              <div class="empty-result"><span class="empty-line"></span><h2>{{ errors.length ? '先修正输入' : '等待本次飞行' }}</h2><p>{{ errors.length ? '完成必填数据校验后，即可评估。' : '填好左侧数据，点击“评估本次飞行”。' }}</p></div>
            </template>
            <div class="result-footnote">结果仅作续航参考，不输出电池健康百分比。</div>
          </div>
          <div v-if="warnings.length" class="warning-box" role="status"><strong>请核对输入</strong><p v-for="w in warnings" :key="w">{{ w }}</p><small v-if="optionalIssues.length">可选项问题不阻止基本评估。</small></div>
          <details v-if="result?.roughEstimate" class="explanation rough-results"><summary>粗估假设与场景 <span>＋</span></summary><div class="explanation-body">
            <p>以下是输入假设与候选值形成的场景，不是统计置信区间、经验证的误差、实际可飞时间、保证时间或安全上限。</p>
            <p v-for="a in result.roughEstimate.assumptions" :key="a">{{ a }}</p>
            <p>基础来自：{{ result.roughEstimate.basis==='ideal'?'理想功率模型':result.roughEstimate.basis==='exact-bench'?'完整型号台架':'匿名同类台架' }}；内部悬停基础时间 {{ result.roughEstimate.baseRangeMinutes.map(t=>t.toFixed(2)).join('–') }} 分钟，方式时间系数 {{ result.roughEstimate.timeFactor }}；结构时间系数 {{ result.roughEstimate.structureFactor === null ? '未应用（未知或台架不重复折减）' : result.roughEstimate.structureFactor }}（用户假设，各乘一次）。</p>
            <div v-if="result.roughEstimate.idealScenario" class="detail-row ideal-scenario"><h3>内部悬停功率基线</h3><p>理想诱导功率 {{ result.roughEstimate.idealScenario.idealPowerW.toFixed(2) }} W；基础总功耗 {{ result.roughEstimate.idealScenario.powerW.toFixed(2) }} W。</p><p>总桨盘面积 {{ result.roughEstimate.idealScenario.totalAreaM2.toFixed(5) }} m²；密度假设 {{ result.roughEstimate.idealScenario.densityKgM3 }} kg/m³；可用能量场景 {{ result.roughEstimate.idealScenario.energyWh.toFixed(3) }} Wh。</p><p>公式与实现已核实，尚无整机实测校准；不能据此确认动力足够或实际能飞这么久。</p></div>
            <div v-for="s in result.roughEstimate.scenarios" :key="s.segmentId" class="detail-row rough-scenario"><h3>测试 {{ s.voltageV }} V · 约 {{ s.minutes.toFixed(2) }} 分钟</h3><p>{{ s.energyWh.toFixed(3) }} Wh / {{ s.powerW.toFixed(2) }} W场景计入功耗；单电机候选{{ s.motorPowerW.toFixed(2) }} W。</p><small>{{ s.segmentId }}<br>{{ s.curveId }} · 库{{ result.categoryBench.version }}；电调／装配／温度未知。</small></div>
          </div></details>
          <details v-if="result" class="explanation category-results"><summary>同类台架候选 <span>＋</span></summary><div class="explanation-body">
            <p class="category-message">{{ result.categoryBench.message }}</p>
            <template v-if="result.categoryBench.candidates.length">
              <p>静态单电机目标推力 {{ result.categoryBench.targetThrustGf }} gf；以下均为单电机候选值。</p>
              <div v-for="c in result.categoryBench.candidates" :key="c.segmentId" class="detail-row candidate-row"><h3>测试 {{ c.voltageV }} V · 约 {{ c.motorPowerW.toFixed(2) }} W</h3><p>推力覆盖 {{ c.thrustRangeGf[0] }}–{{ c.thrustRangeGf[1] }} gf；版本 {{ result.categoryBench.version }}</p><small>{{ c.segmentId }}<br>{{ c.curveId }}</small></div>
              <p>每段独立插值；不同组／电压没有拼接。测试电压不等于起飞静置电压或全程负载电压，尚无对应工况负载电压依据。</p>
              <p>电调是否计入、装配、温度均未知，无实飞验证；表列电功率只由V×I重算。同定子＋KV和几何不保证同款或相同效率，{{ form.estimateMode==='rough' ? '只能组成明确假设下的粗估场景，不能正式评级或补证严格模型。' : '标准模式不能据此计算续航时间或正常评级。' }}</p>
            </template>
            <p>匹配字段：定子规格、KV、桨径、螺距、叶片数、节数；另检查结构、分组、飞行方式、风况及起飞重量。库版本：{{ result.categoryBench.version || '不可用' }}。</p>
          </div></details>
          <details v-if="result" class="explanation"><summary>查看本次分析依据 <span>＋</span></summary><div class="explanation-body">
            <div v-for="d in [...result.details, result.sag, result.rebound].filter(Boolean)" :key="d!.label" class="detail-row"><h3>{{ d!.label }}</h3><strong>{{ d!.value }}</strong><p>{{ d!.basis }}</p></div>
            <template v-if="result.observedRangeSeconds"><h3>已有记录范围（非正常评级阈值）</h3><p>{{ timeRange(result.observedRangeSeconds) }}</p></template>
            <template v-if="result.referenceSeconds"><h3>经独立数据验证的评级区间</h3><p>{{ timeRange(result.referenceSeconds) }}</p></template>
            <h3>未分析的项目</h3><p v-for="n in result.notices" :key="n">{{ n }}</p>
            <h3>参与计算／条件判定的输入</h3><p>{{ result.usedInputs.join('、') }}</p>
            <h3>未用于推算的输入</h3><p v-for="u in result.unusedInputs" :key="u">{{ u }}</p>
          </div></details>
          <details class="explanation"><summary>参考库与适用边界 <span>＋</span></summary><div class="explanation-body">
            <p class="library-note">本版合格实飞参考：0 条，独立工况校准k：0 条。实测参考、严格模型、粗估场景和本次等效续航分别处理；模型、粗估与等效结果不能证明本次续航正常。</p>
            <p>{{ referenceLibrary.available ? `匿名候选库 v${referenceLibrary.version}：${referenceLibrary.motors.length}个规格／KV组合、${referenceLibrary.segments.length}段同电压候选；不能保证覆盖用户的实际电机。` : referenceLibrary.message }}</p>
            <details class="font-license"><summary>字体许可 · 霞鹜文楷</summary><p>霞鹜文楷 v1.530，作者LXGW；基于Klee One，按SIL Open Font License 1.1随程序离线提供。</p><pre>{{ fontLicense }}</pre></details>
            <p>业务数据不含品牌、产品名或外部链接。独立许可署名文件随程序分发，不参与计算。原厂标称、少量记录和未经独立验证的模型不当作正常阈值。</p>
            <p>“回弹”指同次停桨前后电压变化，必须保留两个测量时点；测量间隔长时不解释为瞬时压降。不使用起降电压差线性换算电量，不仅凭 KV 推算功率。</p>
          </div></details>
          <div class="quiet-note"><span class="note-rule"></span><p>没有可靠参考，也是一条有用的结果。<br>信息不足时，工具会直接说明。</p></div>
        </aside>
      </div>
      <footer>FIELD / FPV <span>理论参考与本次实际，分别呈现。</span></footer>
    </main>
  </div>
</template>
