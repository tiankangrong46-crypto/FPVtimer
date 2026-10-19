# GitHub上传与本地清理状态

日期：2026-10-19。当前软件0.7.2，未改变运行算法、配色或现有EXE。

- 私有仓库：https://github.com/tiankangrong46-crypto/FPVtimer
- 发行版：https://github.com/tiankangrong46-crypto/FPVtimer/releases/tag/v0.7.2
- Git保存源码、参考库、测试和本版验收说明；EXE及安装包通过Release分发。开发工具链、node_modules、构建缓存、旧交付和外观临时文件不上传。
- 两个EXE和独立许可的GitHub资产SHA256与本地一致，校验值随Release提供。
- 保留本地工具链及当前参考库；将历史模型审查JSON复制到docs/validation/ideal-model-audit.json，并同步诊断脚本输出位置，避免清理旧目录后丢失方法限制证据。没有重跑业务测试、重建或安装。

## 本地清理（重试后已完成）

用户已明确授权只保留最新版本。首次尝试时计划清理outputs下除v0.7.2以外的17个旧条目，约2.48GiB，并清理旧验收profile等临时文件。首次批量删除命令及随后缩小到单个旧版本目录的删除均被执行环境自动审批拒绝，仅返回blocked by policy，未给出更具体原因。两次拒绝均发生在命令启动前，未删除文件。

用户随后明确要求再试一次；本次删除成功，旧版交付和列明缓存均已移除。旧版程序未上传到该仓库或Release。必要的算法历史说明保留作方法依据，不代表仍维护旧版软件。

### 成功重试记录

- 删除outputs中除v0.7.2以外的17个旧交付条目；最新EXE、安装包、许可、截图和验收记录保留。
- 删除62个临时／历史条目：旧专用WebView2验收profile、旧日志与研究下载缓存、.taste-skill外观临时产物、重复README／AGENTS快照及旧验收脚本。
- 另删除src-tauri/target/release/bundle/nsis中的10个旧版安装包，仅保留0.7.2。
- 共移除89个顶层条目，文件大小合计5027439293字节（约4.68GiB）；不含文件系统额外开销。
- 当前源码、参考库和独立EXE等34个受保护文件哈希与上传前一致；安装包及独立许可校验值与SHA256SUMS.txt一致。
- 保留.tools中的x64 Node、npm包装器、Cargo／Rust工具链以及0.7.2日志；保留node_modules与当前构建缓存，不影响继续开发。
- 未运行或安装程序、未重新构建，既有程序测试记录仍按原验收解释。
