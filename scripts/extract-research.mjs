// Verification only. Never included by src/main.ts. Source has no user data.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const rows = readFileSync('.tools/flight1-electrical.csv','utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).slice(1).map(line=>line.split(',').map(s=>Number(s.replaceAll('"','')))).map(([t,v,i])=>({t,v,i}));
function sampleAt(t) {
  const exact=rows.find(r=>r.t===t); if(exact)return {...exact,interpolated:false};
  const index=rows.findIndex(r=>r.t>t); if(index<=0)throw new Error('Outside measured time range');
  const a=rows[index-1],b=rows[index],f=(t-a.t)/(b.t-a.t);
  return {t,v:a.v+(b.v-a.v)*f,i:a.i+(b.i-a.i)*f,interpolated:true};
}
const samples=[sampleAt(40),...rows.filter(r=>r.t>40&&r.t<100),sampleAt(100)];
let integralAs=0;
for(let j=1;j<samples.length;j++)integralAs+=(samples[j-1].i+samples[j].i)/2*(samples[j].t-samples[j-1].t);
const fixture={
  description:'公开实测电流的60秒片段，仅验证电量/时间换算，不是续航参考或电池压降实测。',
  paper:'https://www.nature.com/articles/s41597-021-00930-x',
  attribution:'Thiago A. Rodrigues et al., Data Collected with Package Delivery Quadcopter Drone (2021).',
  license:'CC BY 4.0 https://creativecommons.org/licenses/by/4.0/',
  sourceArchiveMd5:'cd1d267fd9b025219f9633b95158eea2',
  dataset:'https://doi.org/10.1184/R1/12683453', file:'flights.zip / flights/1.csv',
  download:'https://ndownloader.figshare.com/files/26385070', windowSeconds:[40,100],
  transformation:'仅保留公开研究的time,battery_voltage,battery_current；端点若非原始采样则线性插值并标明；以梯形积分独立算出电量。电压为负载测量，不冒充停桨电压。',
  durationSeconds:60, integralAmpSeconds:integralAs, integratedMah:integralAs/3.6, timeWeightedMeanAmps:integralAs/60,
  samples,
};
mkdirSync('tests/fixtures',{recursive:true}); writeFileSync('tests/fixtures/real-electrical-segment.json',JSON.stringify(fixture,null,2)+'\n');
console.log(JSON.stringify({count:samples.length,mah:fixture.integratedMah,mean:fixture.timeWeightedMeanAmps}));
