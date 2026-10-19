// Human-reviewed source notes bundled locally. Product claims are NOT measured reference ranges.
// Dates are review dates. No personal flight records, synthetic examples or remote calls are shipped.
export const reviewedSources = [
  {
    id: 'betafpv-air65', title: 'BETAFPV Air65 产品页',
    url: 'https://betafpv.com/products/air65-brushless-whoop-quadcopter', reviewed: '2026-10-18',
    kind: '厂商标称', claim: 'LAVA 260 mAh，4.35–3.3 V，标称约 4 分钟。',
    excluded: '没有明确测试飞行方式、完整起飞重量、电压负载状态与测量时点；单个标称值也不是正常范围。',
  },
  {
    id: 'iflight-nazgul-dc5', title: 'iFlight Europe Nazgul DC5 O4 ECO V1.1 产品页',
    url: 'https://iflight-rc.eu/en-ch/products/nazgul-dc5-o4-eco-v1-1-6s-hd', reviewed: '2026-10-18',
    kind: '厂商标称', claim: '6S 1550 mAh，标称最大悬停约 11.5 分钟。',
    excluded: '最大悬停时间不是正常范围；起降电压、截止条件与完整测试环境缺失，不能用于巡航、花飞或竞速评级。',
  },
  {
    id: 'rodrigues-2021-m100', title: 'Rodrigues 等，Scientific Data 2021：Matrice 100 实飞数据',
    url: 'https://www.nature.com/articles/s41597-021-00930-x', reviewed: '2026-10-18',
    kind: '公开实飞研究', claim: '209 次自主飞行，记录时间、电压、电流与风况；采用校准传感器。',
    excluded: '研究对象为载货 Matrice 100，自主任务结束时间不是耗尽可用容量的续航时间，不能外推为普通穿越机的续航范围。',
  },
] as const;
export const modelSources = [
  { title: 'PX4 电池估计：内阻压降、电流积分、传感器校准', url: 'https://docs.px4.io/main/en/config/battery' },
  { title: 'NASA 简化旋翼理论：理想值不包含实际损耗', url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/propeller-thrust/' },
  { title: 'Castle Creations：LiPo 4.20 V / LiHV 4.35 V 单节峰值', url: 'https://castlecreations.com/blogs/castle-news/tech-tips-setting-up-esc-for-hv-lipos' },
] as const;
export interface EnduranceReference {
  id: string; url: string; version: string; evidence: 'independent-flight-records';
  origin: 'real-measurement' | 'synthetic'; status: 'reviewed' | 'pending';
  measurementConditions: string; scope: string;
  conditions: Record<string, string | number | {min:number;max:number}>;
  records: {id:string;seconds:number}[];
  validatedRange?: {
    minSeconds:number; maxSeconds:number; status:'independently-validated'|'unvalidated';
    validationRecordIds:string[]; source:string; method:string;
    sampleAdequacy:'documented-sufficient'|'insufficient'|'unknown'; adequacyBasis:string;
  };
}
// None of the reviewed public claims meets the admission policy in docs/METHOD.md.
export const enduranceReferences: readonly EnduranceReference[] = [];
export interface StyleCalibration {
  id:string; version:string; source:string; status:'independently-validated'|'pending';
  origin:'real-measurement'|'synthetic'; configurationGroup:'open'|'ducted'|'whoop';
  style:'cruise'|'freestyle'|'race'; conditions:EnduranceReference['conditions'];
  multiplier:number; definition:'total-electrical-power'; measurementConditions:string;
  validation:{source:string;method:string;calibrationRecordIds:string[];independentRecordIds:string[]};
}
// No default multipliers. Calibration is for total P_style / total P_hover, including auxiliaries.
export const styleCalibrations: readonly StyleCalibration[] = [];
