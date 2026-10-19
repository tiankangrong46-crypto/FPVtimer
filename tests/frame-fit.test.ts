import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {blankInput,type RawInput} from '../src/domain/types';
import {validate} from '../src/domain/validation';
import {analyze} from '../src/domain/analysis';
import {frameFit,frameSizeExamples} from '../src/domain/frame-fit';
import {geometryChoices,geometryKey} from '../src/domain/category-bench';
function input(o:Partial<RawInput>={}){const v=validate({...blankInput(),style:'hover',weight:'650.5',wheelbase:'225',stator:'2306',kv:'1850',diameter:'5.1',pitch:'3.5',blades:'3',capacity:'1300',cells:'6',minutes:'4',seconds:'30',startVoltage:'25.2',endVoltage:'22.2',...o});assert.ok(v.input,JSON.stringify(v.errors));return v;}
describe('机架mm／桨叶英寸与实际机架上限',()=>{
  it('真实厂商尺寸示例是独立例子，不变成轴距通用对应表',()=>{
    assert.deepEqual(frameSizeExamples,[{wheelbaseMm:144,propellerIn:3},{wheelbaseMm:160,propellerIn:3.5},{wheelbaseMm:225,propellerIn:5.1}]);
    const v=input({wheelbase:'225.1',frameMaxProp:'未知'});assert.equal(frameFit(v.input!).allowed,true);assert.match(frameFit(v.input!).note,/未知/);
  });
  it('5英寸上限阻止5.1桨；5.1上限允许5.1以及较小桨，不误写必须等径',()=>{
    const bad=analyze(input({frameMaxProp:'5'}).input!);assert.equal(bad.roughEstimate,null);assert.match(bad.reason,/5.1英寸超过.*5英寸/);
    for(const diameter of ['5.1','5'])assert.ok(analyze(input({frameMaxProp:'5.1',diameter}).input!).roughEstimate);
  });
  it('未知／空与零／非法不同，尺寸上限问题不阻断基本分析',()=>{
    for(const frameMaxProp of ['','未知']){const v=input({frameMaxProp});assert.equal(v.optionalIssues.length,0);assert.ok(analyze(v.input!).roughEstimate);}
    for(const frameMaxProp of ['0','-1','5.11','oops']){const v=input({frameMaxProp});assert.ok(v.optionalIssues.some(i=>i.field==='frameMaxProp'));assert.equal(analyze(v.input!).roughEstimate,null);}
    const r=analyze(input({frameMaxProp:'5',current:'15',currentSource:'calibrated-flight',resistance:'3.5',resistanceMethod:'dc',resistanceDevice:'TEST meter'}).input!);assert.ok(r.sag);assert.equal(r.comparison,null);
  });
  it('精确库内桨径不舍入后绕过上限，输入变化影响适配判定',()=>{
    const g=geometryChoices().find(g=>g.diameterIn===1.22)!;assert.ok(g);
    const v=input({libraryGeometry:geometryKey(g),frameMaxProp:'1.2'});assert.equal(frameFit(v.input!).allowed,false);
    assert.equal(frameFit(input({libraryGeometry:geometryKey(g),frameMaxProp:'1.3'}).input!).allowed,true);
  });
  it('有上限但桨径缺失不从型号猜尺寸',()=>{
    const v=input({diameter:'',pitch:'',blades:'',propModel:'unknown geometry',frameMaxProp:'5'});assert.equal(frameFit(v.input!).allowed,false);assert.match(frameFit(v.input!).note,/实际桨径未知/);
  });
});
