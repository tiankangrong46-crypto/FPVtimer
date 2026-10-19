# FPV Endurance · 穿越机续航参考与实际对比

Windows本地单页应用，Tauri 2 + Vue 3 + TypeScript + Vite，当前版本 **0.7.2**（2026-10-19），使用淡蓝色主题。运行离线，不上传、不保存飞行记录；不需要开发工具。

**目标：给出所选结构和飞行方式下的理论参考时间，并与本次实际时长对比。** 用户结构时间与方式系数是明确假设，未经实机校准；差值不代表电池健康或正式续航评级。

GitHub仓库：[FPVtimer](https://github.com/tiankangrong46-crypto/FPVtimer)；[下载0.7.2安装包／独立程序](https://github.com/tiankangrong46-crypto/FPVtimer/releases/tag/v0.7.2)。Git保存源码和验收说明，EXE通过Release分发，克隆仓库后需另行下载。

接手先读[AGENTS.md](AGENTS.md)、[0.7.2发行说明](docs/RELEASE-0.7.2.md)、[0.7.1算法变更](docs/ALGORITHM-0.7.1.md)、[0.7.0完整规则](docs/ALGORITHM-0.7.0.md)和[本版验收记录](outputs/v0.7.2/验收记录.md)。0.7.2只调整配色及发行版本，算法沿用0.7.1；0.7.0文档中的旧花飞／竞速系数以0.7.1为准。算法历史说明作为依据保留；按用户2026-10-19授权，本地仅保留0.7.2交付，旧安装包与临时验收缓存已清理。

## 运行与使用

- [直接运行版](https://github.com/tiankangrong46-crypto/FPVtimer/releases/download/v0.7.2/FPV-Endurance-0.7.2.exe)：电脑需已有WebView2，分发时同附`LICENSE-ATTRIBUTION.md`。
- [安装包](https://github.com/tiankangrong46-crypto/FPVtimer/releases/download/v0.7.2/FPV-Endurance-0.7.2-x64-setup.exe)：包含WebView2完整离线安装组件和独立许可，供用户自行安装。本次不自动安装。

目标Windows 10/11 x64，实际检查为Windows 11 x64、已有WebView2。未签名，缺WebView2的干净电脑首次离线安装未实测。独立EXE自身不包含WebView2。旧安装版仍可能指向旧版本，请运行本版目录中的EXE。

1. 默认进入“粗估模式”，用于理论参考与实际比较；“标准评估”继续独立提供实飞参考、严格模型和本次电流等效。
2. 填飞机、电池和本次飞行。飞机结构仅“裸桨／圈圈”；圈圈统一包括涵道／Whoop，是用户指定分类。
3. 选悬停、巡航、花飞或竞速，点击“评估本次飞行”，也可按Ctrl+Enter。
4. 主结果显示该工况理论时间、实际时间、实际减参考的差值、实际除参考的达成率。超过100%不截断，也不自动评优秀。
5. 展开“可选电池分析”可改结构时间系数、能量／辅助假设、测量来源和区间条件；公式、基线、候选曲线编号和缺失项放折叠依据。

初始／清空为裸桨25%；切圈圈填18%，切回裸桨填25%，界面提示切换会重填时间系数。允许手改、空／未知和明确0；未知给明确未应用结构折减的假设场景，0停止理想时间比较，100%保留全部基础时间。这些结构系数只用于理想后备，台架分支不重复折减。任何输入变化使旧结果立即失效；关闭或重载不保存记录。

## 当前算法

| 项目 | 用户假设／计算 |
| --- | --- |
| 裸桨时间保留（仅理想分支） | 时间×0.25（用户假设） |
| 圈圈时间保留（仅理想分支） | 时间×0.18（用户假设） |
| 悬停时间系数 | 1.00 |
| 巡航时间系数 | 0.80 |
| 花飞时间系数 | 0.58 |
| 竞速时间系数 | 0.33 |

理想分支依次计算：理想桨盘功率加辅助功耗→60×可用Wh/P基础→乘结构时间保留系数与方式系数，各一次。旧35%／45%功率侧损耗已替换，不叠加旧8%／13%或任意功耗倍率。25%表示最终时间保留25%，不是保留75%。

```text
P基础 = P理想 + P辅助
T基础(min) = 60 × E可用(Wh) / P基础(W)
T工况 = T基础 × 结构时间保留系数 × 飞行方式时间系数
时间差 = 实际 − T工况；达成率 = 实际 / T工况 × 100%
```

方式系数乘时间，不是乘功率或除时间。范围结果是能量、功率和用户假设形成的场景范围，不是统计置信区间。

适用的完整型号台架优先，其次裸桨匿名同类段，最后有效范围内的理想模型。台架已有电输入功率，继续不额外套结构时间保留系数，避免重复折减；仍乘最后的方式时间系数。匿名不拼组、不跨电压、不借邻近KV、不外推，不修改unknown。圈圈不套裸桨匿名台架，只提供理想基线＋用户时间假设场景，未模拟涵道增升、桨尖间隙或气流干扰。原有正方形独立桨盘、重叠和低马赫数范围检查保留，不核实真实最大推力。

能量有充分依据的目标可用Wh优先；无此依据可明确给标称能量假设场景。LiPo按3.7V／节；LiHV需按标签选择3.80／3.85V，未知则不能从容量计算Wh。容量比例未知明确写“假设标称能量全部可用”；辅助未知只给“仅计推进功耗”，不冒充实际0W。没有有效功率或必要条件仍允许无法计算，并说明具体原因。

实际飞行时长、本次电流和消耗量不参与理论时间。原电流等效分析单独保留，不能再用自身数据证明本次正常。当前合格实飞参考和独立工况k均为空，未添加虚构参考；正式评级逻辑独立保留，只有有依据的独立验证区间才允许评级。

比较不设正常／偏短的百分比阈值，不判电池损坏或健康百分比。电量区间／截止条件未知、不同或提前落地时提示“使用区间可能不同，不能据此判断性能异常”。用户确认一致还需完整目标能量区间及对应停桨端点；此确认不是程序独立测量。既不按电压差线性换算电量，也不从起飞静置电压猜全程负载电压。

机架轴距继续mm，桨径继续英寸。新增“机架允许最大桨径”，按实际机架说明书填写；超限停止理论估算，空／未知明确安装适配未核实，不根据轴距猜上限。5英寸级机架可能允许5～5.1英寸，厂商实例与范围见[尺寸核查](docs/FRAME-SIZES-0.7.0.md)。通过直径上限检查不代表全部安装间隙满足。

## 输入与分层

重量g含电池与载荷；轴距mm为对角电机轴距，桨径／螺距英寸。电压为整包V，最多三位小数；重量／容量／内阻等最多一位小数；1–8S、叶片、分秒使用整数，秒0–59。定子保留字符串0802／2806.5，精确库内桨几何不舍入。空、零、未知、非法分别处理；必填非法阻止计算，可选问题仅跳过对应分析。

- `src/App.vue`／`MeasureField.vue`／`style.css`：收集与显示，输入变动失效；不维护计算公式。
- `src/domain/structure.ts`：唯一结构及25%／18%时间保留默认映射。
- `src/domain/flight-scenario.ts`：唯一方式系数、最终时间换算、差值／达成率和区间说明。
- `rough-estimate.ts`：台架／理想基础与最终工况时间；`ideal-hover.ts`唯一理想物理公式。
- `endurance.ts`／`reference.ts`／`bench.ts`：独立评级、严格模型／台架基线、电流等效、单位与插值。
- `analysis.ts`：统一整合理论、比较及其他有效分析；Rust仅负责窗口，不复制算法。
- `validation.ts`／`types.ts`：原始字符串、精度、未知、非法、数据类型和默认值。
- `src/data/reference-library.ts`直接引用`reference-library/v0.1.0/`的7份JSON和manifest；不复制产品库、无运行时下载。
- `tests/`：计算、边界、真实电流单位换算和页面测试；人工夹具不进入产品参考。
- `scripts/desktop-smoke.mjs`调用`desktop-flight-scenario.mjs`，只连接专用实际EXE WebView2，旧脚本留在archive中。

压降仍需正内阻、明确直流／充电器方式设备及有依据同一时段平均电流；只是平均电阻项粗估，不能代表峰值，充电器测量不确定性需保留。回弹需要同次停桨、同设备、前后时点及期间电量变化可忽略等依据；不足时最多显示读数差，不作回弹解释。电池分析补充字段均在可选电池分析；机架最大桨径属于飞机配置。无账号、云服务、历史数据库或联网AI。

## 开发与验证

本机系统Node是ia32，需先加载项目内x64工具链；不修改系统PATH。`.tools`仅供开发，不进入安装包，换机需核实。依赖由npm／Cargo lock锁定，TypeScript固定5.9.3。未提交／未跟踪文件不是垃圾，禁止git clean或强制重置；当前已迁入GitHub仓库，后续先查看git status。

```powershell
. .\scripts\Use-Toolchain.ps1
node -p "process.arch"  # 应为x64
npm.cmd ci             # 首次或依赖变化时
npm.cmd test
npm.cmd run check
npm.cmd run test:ui
npm.cmd run desktop:build
```

UI测试首次需安装独立Chromium：`npm.cmd exec playwright install chromium`。`npm.cmd run dev`启动127.0.0.1:1420；Tauri开发使用`npm.cmd run tauri -- dev`。`npm.cmd run build`仅前端；`desktop:build`校验匿名库、运行计算测试、调用前端构建／类型检查及Rust／NSIS，并按精确版本复制EXE、安装包和许可到outputs，不拿旧包冒充。它不自动运行页面测试或实际EXE验收，算法说明和验收记录另行维护。运行时不依赖Vite、Node、Rust或远程字体／CDN。NSIS使用offlineInstaller，独立许可实际嵌入且随独立程序分发。

实际桌面检查使用当前版本EXE、专用profile及临时9224端口，不能代替物理断网或干净系统首次安装。以下为复查步骤。启动前先检查端口，用独立输出目录避免覆盖已有验收；结束时仅关闭本次专用EXE并恢复环境变量：

```powershell
. .\scripts\Use-Toolchain.ps1
$taskExe = (Resolve-Path -LiteralPath 'outputs\v0.7.2\FPV-Endurance-0.7.2.exe').Path
if (Get-NetTCPConnection -State Listen -LocalPort 9224 -ErrorAction SilentlyContinue) {
    throw '9224已占用，请先核实占用者，不要关闭无关进程。'
}
$taskRun = Join-Path $PWD ('.tools\desktop-review-' + [guid]::NewGuid().ToString('N'))
$taskEnvNames = @('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS', 'WEBVIEW2_USER_DATA_FOLDER', 'FPV_DESKTOP_EXE', 'FPV_OUTPUT_DIR')
$taskOldEnv = @{}
foreach ($taskName in $taskEnvNames) {
    $taskOldEnv[$taskName] = [Environment]::GetEnvironmentVariable($taskName, 'Process')
}
$taskProcess = $null
try {
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9224 --disable-background-networking --disable-component-update'
    $env:WEBVIEW2_USER_DATA_FOLDER = Join-Path $taskRun 'profile'
    $taskProcess = Start-Process -FilePath $taskExe -WindowStyle Hidden -PassThru
    # 子进程已继承，立即恢复启动参数，避免影响后续其他程序。
    foreach ($taskName in $taskEnvNames[0..1]) {
        [Environment]::SetEnvironmentVariable($taskName, $taskOldEnv[$taskName], 'Process')
    }
    $env:FPV_DESKTOP_EXE = $taskExe
    $env:FPV_OUTPUT_DIR = Join-Path $taskRun 'results'
    $taskReady = $false
    $taskDeadline = [DateTime]::UtcNow.AddSeconds(30)
    while ([DateTime]::UtcNow -lt $taskDeadline) {
        if ($taskProcess.HasExited) { throw '验收EXE提前退出。' }
        try {
            $null = Invoke-RestMethod -Uri 'http://127.0.0.1:9224/json/version' -TimeoutSec 1
            $taskReady = $true
            break
        } catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $taskReady) { throw 'WebView2调试端口未在30秒内就绪。' }
    node scripts/desktop-smoke.mjs
    if ($LASTEXITCODE -ne 0) { throw '桌面验收失败，请检查输出。' }
    Write-Output ('复查结果：' + $env:FPV_OUTPUT_DIR)
} finally {
    foreach ($taskName in $taskEnvNames) {
        [Environment]::SetEnvironmentVariable($taskName, $taskOldEnv[$taskName], 'Process')
    }
    if ($taskProcess -and -not $taskProcess.HasExited) {
        $taskOwned = Get-Process -Id $taskProcess.Id -ErrorAction SilentlyContinue
        if ($taskOwned -and $taskOwned.Path -eq $taskExe) {
            $null = $taskOwned.CloseMainWindow()
            if (-not $taskOwned.WaitForExit(3000)) { $taskOwned | Stop-Process }
        }
    }
    $taskReleaseDeadline = [DateTime]::UtcNow.AddSeconds(5)
    while ((Get-NetTCPConnection -State Listen -LocalPort 9224 -ErrorAction SilentlyContinue) -and [DateTime]::UtcNow -lt $taskReleaseDeadline) {
        Start-Sleep -Milliseconds 250
    }
    if (Get-NetTCPConnection -State Listen -LocalPort 9224 -ErrorAction SilentlyContinue) {
        Write-Warning '9224仍在监听，请核实本次专用进程是否完全退出，不要按端口盲目终止其他程序。'
    }
}
```

最近一次0.7.2验收（2026-10-19）：149项计算、24项页面、类型检查及28项实际EXE离线模拟检查通过，详见[验收记录](outputs/v0.7.2/验收记录.md)和[对象SHA／检查JSON](outputs/v0.7.2/desktop-checks.json)。已重新构建淡蓝主题独立EXE及包含完整WebView2离线组件的安装包，新增实际EXE版本与配色检查；未执行安装；旧版交付已按用户后续授权清理。

尚无实机校准结构时间、方式系数或整机续航精度；未验证全新无WebView2系统首次离线安装、本版安装／升级／卸载、Windows 10、ARM64、32位或全部缩放。离线检查是WebView2网络模拟，不是物理断网或完整系统网络审计。不要将旧版安装结论沿用于本版。
