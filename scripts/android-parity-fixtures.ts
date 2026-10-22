import { writeFileSync, mkdirSync } from 'node:fs';
import { blankInput } from '../src/domain/types';
import { validate } from '../src/domain/validation';
import { analyze } from '../src/domain/analysis';
import { comparisonSummary, flightScenarios } from '../src/domain/flight-scenario';
const sample={weight:'650.5',wheelbase:'225',stator:'2306',kv:'1850',diameter:'5.1',pitch:'3.5',blades:'3',capacity:'1300',cells:'6',minutes:'4',seconds:'30',startVoltage:'25.200',endVoltage:'22.200'};
import { selectStructure } from '../src/domain/structure';
mkdirSync('.tools/android',{recursive:true});
const cases=[];
for(const [aircraft,roughStructurePercent] of [['quad','25'],['whoop','18']]) for(const [style,scenario] of Object.entries(flightScenarios)) {
  const input=validate({...blankInput(),...sample,...selectStructure(aircraft),style,roughStructurePercent}).input!;
  const result=analyze(input);
  cases.push({aircraft,style,label:scenario.label,range:result.roughEstimate!.rangeMinutes,comparison:comparisonSummary(result.comparison!)});
}
writeFileSync('.tools/android/parity-fixtures.json',JSON.stringify({sample,cases},null,2));
