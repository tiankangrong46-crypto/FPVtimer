# 0.7.3 用户选定logo与Windows图标

2026-10-21。使用用户本次明确选定的黑白人物图片作为应用logo与图标，不重新生成、不重新描绘人物。保留淡蓝主题、全部输入和计算行为；算法继续沿用[0.7.1](ALGORITHM-0.7.1.md)与[0.7.0](ALGORITHM-0.7.0.md)。

- 用户选定图原样保存为`src/assets/app-logo.png`，1254×1254，SHA256为`5CA5FB9B809538B8B7849D8D40286DF2065D63A3FD31C91FB22A0BFAB5CF6A42`。
- 顶部字母F替换为44×44图片logo；保留完整图片比例及现有文字，使用本地静态资源。浏览器favicon使用同一图片。
- 通过现有Tauri CLI从该图片生成Windows ICO，包含16／24／32／48／64／256像素六种32位图像；`src-tauri/icons/icon.ico`用于主程序及NSIS安装包。辅助PNG尺寸为32／64／128／256像素。
- package及npm lock、Cargo及lock、Tauri版本与窗口标题同步为0.7.3。
- 页面测试新增logo在桌面、760px、390px加载与布局检查；实际EXE检查新增离线logo原始字节与favicon一致性检查。验收另核对主程序／安装包PE资源中的全部六种ICO图像。

0.7.3本地交付已被新版替代并按用户要求清理；本页保留历史改动说明，当前产物及其验证见[0.7.4验收记录](../outputs/v0.7.4/验收记录.md)，不能将新版测试当作旧版证据。本任务不安装软件、不提交或推送Git、不发布GitHub Release；既有GitHub v0.7.2仍是历史发布。
