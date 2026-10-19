# GitHub上传与本地清理状态

日期：2026-10-19。当前软件0.7.2，未改变运行算法、配色或现有EXE。

- 私有仓库：https://github.com/tiankangrong46-crypto/FPVtimer
- 发行版：https://github.com/tiankangrong46-crypto/FPVtimer/releases/tag/v0.7.2
- Git保存源码、参考库、测试和本版验收说明；EXE及安装包通过Release分发。开发工具链、node_modules、构建缓存、旧交付和外观临时文件不上传。
- 两个EXE和独立许可的GitHub资产SHA256与本地一致，校验值随Release提供。
- 保留本地工具链及当前参考库；将历史模型审查JSON复制到docs/validation/ideal-model-audit.json，并同步诊断脚本输出位置，避免清理旧目录后丢失方法限制证据。没有重跑业务测试、重建或安装。

## 未完成的本地清理

用户已明确授权只保留最新版本。本次计划清理outputs下除v0.7.2以外的17个旧条目，约2.48GiB，并清理旧验收profile等临时文件。批量删除命令及随后缩小到单个旧版本目录的删除均被执行环境自动审批拒绝，仅返回blocked by policy，未给出更具体原因。两次拒绝均发生在命令启动前，未删除文件。

因此本地旧版本和临时缓存实际仍在；不能将上传成功视作清理完成。旧版程序未上传到该仓库或Release。必要的算法历史说明保留作方法依据，不代表仍维护旧版软件。
