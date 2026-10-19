# FPV Endurance · 穿越机续航参考与实际对比

Windows本地单页应用，Tauri 2 + Vue 3 + TypeScript + Vite，当前版本 **0.6.0**（2026-10-18）。运行离线，不上传、不保存飞行记录；不需要开发工具。

**目标：给出所选结构和飞行方式下的理论参考时间，并与本次实际时长对比。** 用户损耗与方式系数是明确假设，未经实机校准；差值不代表电池健康或正式续航评级。

接手先读[AGENTS.md](AGENTS.md)、[当前算法](docs/ALGORITHM-0.6.0.md)和[本版验收记录](outputs/v0.6.0/验收记录.md)。旧README副本在`docs/history/README-v0.5.2.md`，旧算法和所有版本安装包保留。

## 运行与使用

- [直接运行版](outputs/v0.6.0/FPV-Endurance-0.6.0.exe)：电脑需已有WebView2，分发时同附`LICENSE-ATTRIBUTION.md`。
- [安装包](outputs/v0.6.0/FPV-Endurance-0.6.0-x64-setup.exe)：包含WebView2完整离线安装组件和独立许可，供用户自行安装。本次不自动安装。

目标Windows 10/11 x64，实际检查为Windows 11 x64、已有WebView2。未签名，缺WebView2的干净电脑首次离线安装未实测。独立EXE自身不包含WebView2。旧安装版仍可能指向旧版本，请运行本版目录中的EXE。

1. 默认进入“粗估模式”，用于理论参考与实际比较；“标准评估”继续独立提供实飞参考、严格模型和本次电流等效。
2. 填飞机、电池和本次飞行。飞机结构仅“裸桨／圈圈”；圈圈统一包括涵道／Whoop，是用户指定分类。
3. 选悬停、巡航、花飞或竞速，点击“评估本次飞行”，也可按Ctrl+Enter。
4. 主结果显示该工况理论时间、实际时间、实际减参考的差值、实际除参考的达成率。超过100%不截断，也不自动评优秀。
5. 展开“可选电池分析”可改损耗、能量／辅助假设、测量来源和区间条件；公式、基线、候选曲线编号和缺失项放折叠依据。

初始／清空为裸桨35%；切圈圈填45%，切回裸桨填35%，界面提示切换会重填损耗。允许手改、空／未知和明确0。任何输入变化使旧结果立即失效；关闭或重载不保存记录。

## 当前算法

| 项目 | 用户假设／计算 |
| --- | --- |
| 裸桨损耗 | 35%，P推进=P理想/0.65 |
| 圈圈损耗 | 45%，P推进=P理想/0.55 |
| 悬停时间系数 | 1.00 |
| 巡航时间系数 | 0.80 |
| 花飞时间系数 | 0.65 |
| 竞速时间系数 | 0.40 |

理想分支依次计算：理想桨盘功率→功率侧损耗→加辅助功耗→60×可用Wh/P总→最后乘所选方式时间系数一次。旧8%／13%及任意飞行功耗倍率入口已移除；不能再在时间上重复扣推进损耗。

适用的完整型号台架优先，其次裸桨匿名同类段，最后有效范围内的理想模型。台架已有电输入功率不额外套35%／45%，仍乘最后的方式时间系数。匿名不拼组、不跨电压、不借邻近KV、不外推，不修改unknown。圈圈不套裸桨匿名台架，只提供理想基线＋用户损耗假设场景，未模拟涵道增升、桨尖间隙或气流干扰。原有正方形独立桨盘、重叠和低马赫数范围检查保留，不核实真实最大推力。

能量有充分依据的目标可用Wh优先；无此依据可明确给标称能量假设场景。LiPo按3.7V／节；LiHV需按标签选择3.80／3.85V，未知则不能从容量计算Wh。容量比例未知明确写“假设标称能量全部可用”；辅助未知只给“仅计推进功耗”，不冒充实际0W。没有有效功率或必要条件仍允许无法计算，并说明具体原因。

实际飞行时长、本次电流和消耗量不参与理论时间。原电流等效分析单独保留，不能再用自身数据证明本次正常。当前合格实飞参考和独立工况k均为空，未添加虚构参考；正式评级逻辑独立保留，只有有依据的独立验证区间才允许评级。

比较不设正常／偏短的百分比阈值，不判电池损坏或健康百分比。电量区间／截止条件未知、不同或提前落地时提示“使用区间可能不同，不能据此判断性能异常”。用户确认一致还需完整目标能量区间及对应停桨端点；此确认不是程序独立测量。既不按电压差线性换算电量，也不从起飞静置电压猜全程负载电压。

## 输入与分层

重量g含电池与载荷；轴距mm为对角电机轴距，桨径／螺距英寸。电压为整包V，最多三位小数；重量／容量／内阻等最多一位小数；1–8S、叶片、分秒使用整数，秒0–59。定子保留字符串0802／2806.5，精确库内桨几何不舍入。空、零、未知、非法分别处理；必填非法阻止计算，可选问题仅跳过对应分析。

- `src/App.vue`／`MeasureField.vue`／`style.css`：收集与显示，输入变动失效；不维护计算公式。
- `src/domain/structure.ts`：唯一结构及35%／45%默认映射。
- `src/domain/flight-scenario.ts`：唯一方式系数、最终时间换算、差值／达成率和区间说明。
- `rough-estimate.ts`：台架／理想基础与最终工况时间；`ideal-hover.ts`唯一理想物理公式。
- `endurance.ts`／`reference.ts`／`bench.ts`：独立评级、严格模型／台架基线、电流等效、单位与插值。
- `analysis.ts`：统一整合理论、比较及其他有效分析；Rust仅负责窗口，不复制算法。
- `validation.ts`／`types.ts`：原始字符串、精度、未知、非法、数据类型和默认值。
- `src/data/reference-library.ts`直接引用`reference-library/v0.1.0/`的7份JSON和manifest；不复制产品库、无运行时下载。
- `tests/`：计算、边界、真实电流单位换算和页面测试；人工夹具不进入产品参考。
- `scripts/desktop-smoke.mjs`调用`desktop-flight-scenario.mjs`，只连接专用实际EXE WebView2，旧脚本留在archive中。

压降仍需正内阻、明确直流／充电器方式设备及有依据同一时段平均电流；只是平均电阻项粗估。回弹需要同次停桨、同设备、前后时点等依据；未知只跳过对应分析。所有补充字段均在可选电池分析，无账号、云服务、历史数据库或联网AI。

## 开发与验证

本机系统Node是ia32，需先加载项目内x64工具链；不修改系统PATH。`.tools`仅供开发，不进入安装包，换机需核实。依赖由npm／Cargo lock锁定，TypeScript固定5.9.3。未提交／未跟踪文件不是垃圾，禁止git clean或强制重置。

```powershell
. .\scripts\Use-Toolchain.ps1
node -p "process.arch"  # 应为x64
npm.cmd ci
npm.cmd test
npm.cmd run check
npm.cmd run test:ui
npm.cmd run desktop:build
```

UI测试首次需安装独立Chromium：`npm.cmd exec playwright install chromium`。`npm.cmd run build`仅前端；`desktop:build`校验匿名库、测试、构建Rust／NSIS，并按精确版本复制到outputs，不拿旧包冒充。运行时不依赖Vite、Node、Rust或远程字体／CDN。NSIS使用offlineInstaller，独立许可实际嵌入且随独立程序分发。

实际桌面检查使用当前版本EXE、专用profile及临时9224端口，不能代替物理断网或干净系统首次安装：

```powershell
. .\scripts\Use-Toolchain.ps1
$taskExe = Join-Path $PWD 'outputs\v0.6.0\FPV-Endurance-0.6.0.exe'
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9224 --disable-background-networking --disable-component-update'
$env:WEBVIEW2_USER_DATA_FOLDER = Join-Path $PWD '.tools\v0.6.0-desktop-profile'
$taskProcess = Start-Process -FilePath $taskExe -WindowStyle Hidden -PassThru
Remove-Item Env:\WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
Remove-Item Env:\WEBVIEW2_USER_DATA_FOLDER
$env:FPV_DESKTOP_EXE = $taskExe
# 等待就绪后运行；先确认9224未被其他进程占用：
node scripts/desktop-smoke.mjs
Remove-Item Env:\FPV_DESKTOP_EXE
# 最后关闭已核实路径的本次专用EXE，确认9224不再监听。
```

本次144项计算、23项页面、类型检查及24项实际EXE离线模拟检查通过，见[验收记录](outputs/v0.6.0/验收记录.md)，区分程序行为与预测精度。尚无实机校准损耗、方式系数或整机续航精度；未验证全新无WebView2系统的离线安装、Windows 10、ARM64、32位或全部缩放。不要将旧版安装结论沿用于本版。
