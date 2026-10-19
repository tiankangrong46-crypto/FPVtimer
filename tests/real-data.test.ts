import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { averageCurrentFromCharge } from '../src/domain/analysis';

it('公开Matrice100实测电流片段：梯形积分后校验mAh与平均电流换算（不验证穿越机续航精度）',()=>{
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/real-electrical-segment.json',import.meta.url),'utf8'));
  const samples=fixture.samples as {t:number;i:number}[];
  let integralAs=0;
  for(let j=1;j<samples.length;j++)integralAs+=(samples[j-1].i+samples[j].i)/2*(samples[j].t-samples[j-1].t);
  const duration=samples.at(-1)!.t-samples[0].t;
  assert.equal(duration,60);
  const consumedOneDecimal=Number((integralAs/3.6).toFixed(1));
  const calculated=averageCurrentFromCharge(consumedOneDecimal,duration)!;
  // One decimal mAh implies at most 0.05mAh rounding, i.e. 0.003A for 60s. No fitted model tolerance.
  assert.ok(Math.abs(calculated-integralAs/duration)<=0.05*3.6/duration+1e-12);
  assert.equal(averageCurrentFromCharge(0,duration),null);
  assert.equal(averageCurrentFromCharge(100,0),null);
});
