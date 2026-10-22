// Confirmed exit test on the dedicated emulator, separate from cancelled-back tests.
import { _android as android } from 'playwright';
import { expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const app='com.local.fpvendurance';
const version=JSON.parse(readFileSync('package.json','utf8')).version;
const versionCode=JSON.parse(readFileSync('src-tauri/tauri.android.conf.json','utf8')).bundle.android.versionCode;
const delivery=`Android/v${version}-build${versionCode}`;
if(execFileSync('adb',['-s','emulator-5554','emu','avd','name'],{encoding:'utf8'}).split(/\r?\n/)[0].trim()!=='FPV_Endurance_API35')throw Error('Wrong emulator');
const shell=(...args)=>execFileSync('adb',['-s','emulator-5554','shell',...args],{encoding:'utf8',timeout:15000}).trim();
const device=async()=>(await android.devices()).find(d=>d.serial()==='emulator-5554');
let d=await device();
try{const p=await(await d.webView({pkg:app})).page();await p.locator('#weight').fill('650.5');await p.evaluate(()=>document.activeElement?.blur());}finally{await d.close();}
let xml='';
for(let attempt=0;attempt<2;attempt++){
 shell('input','keyevent','4');shell('uiautomator','dump','/sdcard/fpv-exit.xml');xml=shell('cat','/sdcard/fpv-exit.xml');if(xml.includes('离开 FPV Endurance'))break;
}
const n=xml.match(/<node[^>]*text="离开"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
if(!n)throw Error('Exit confirmation not found');
shell('input','tap',String((+n[1]+ +n[3])/2),String((+n[2]+ +n[4])/2));
// Let the Activity finish before launching again, as a person returning to the launcher would.
await delay(1000);shell('am','start','-W','-n',`${app}/com.local.fpvendurance.MainActivity`);
d=await device();
try{
 const p=await(await d.webView({pkg:app})).page();await expect(p.locator('#weight')).toHaveValue('');
 const apkSHA256=createHash('sha256').update(readFileSync(`${delivery}/FPV-Endurance-${version}-build${versionCode}-android-release.apk`)).digest('hex');
 writeFileSync(`${delivery}/exit-relaunch-check.json`,JSON.stringify({package:app,apkSHA256,environment:'Android15 x86_64 emulator',confirmedExitAndRelaunchClearsForm:true},null,2));
 console.log('Confirmed exit and normal relaunch clear input.');
}finally{await d.close();}
