// Offline diagnostic only. Uses the same physical formula, never trains or ships a universal loss coefficient.
import { referenceLibrary } from '../src/data/reference-library.ts';
import { idealHoverPower } from '../src/domain/ideal-hover.ts';
import { mkdirSync,writeFileSync } from 'node:fs';
if(!referenceLibrary.available)throw Error(referenceLibrary.message);
const ratios=[];
for(const curve of referenceLibrary.curves){
  if(!curve.propeller)continue;
  for(const p of curve.points){
    const hover=idealHoverPower(p.thrustGf*4,curve.propeller.diameterIn);
    if(hover)ratios.push({curveId:curve.id,ratio:hover.idealPowerW/4/p.electricalPowerW});
  }
}
const values=ratios.map(r=>r.ratio).sort((a,b)=>a-b);
const report={libraryVersion:referenceLibrary.version,knownGeometryPoints:values.length,
  idealToTabulatedPowerRatio:{min:values[0],median:values[Math.floor(values.length/2)],max:values.at(-1)},
  ratiosAboveOne:values.filter(v=>v>1).length,
  interpretation:'Diagnostic under standard-density free-air ideal assumptions only. Table conditions are unknown; ratios do not establish a universal correction or independent flight accuracy. Ratios above one show unresolved incompatibility with these assumptions or data.',
  calibratedDefaultLoss:null};
mkdirSync('docs/validation',{recursive:true});writeFileSync('docs/validation/ideal-model-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
