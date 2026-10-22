# Android 移植与构建（0.7.4，当前build 7005）

更新至2026-10-22。当前Android发行交付独立在项目根目录`Android/v0.7.4-build7005/`；原build7004包已清理，历史证据位于`docs/validation/android-port-build7004/`。`outputs/v0.7.4/`的Windows程序、安装包和验收文件保持原字节，不以Android构建覆盖。源码在Git，APK／EXE通过[v0.7.4 Release](https://github.com/tiankangrong46-crypto/FPVtimer/releases/tag/v0.7.4)分发。

build7005只调整Android定子标签和操作按钮；共用算法、系数、数据、Windows显示不变。Android UA应用独立样式类，主次操作等高、手机不显示桌面箭头或快捷键。仍使用原发行密钥与包名，提升versionCode至7005；versionName保持0.7.4，不为Android局部修订更改Windows版本。构建脚本自动输出到`Android/v版本-build版本码/`，APK文件名同样带版本码。

## 共用与平台边界

- `src/domain`、`src/data`及匿名库原样共用。没有新增Kotlin／Rust计算公式，没有改系数、评级或适用性边界；本次时长、电流、消耗量不反馈理论参考。
- `src-tauri/src/lib.rs`为唯一Tauri启动逻辑；Windows的`main.rs`调用它，移动端使用`mobile_entry_point`。
- 通用配置在`tauri.conf.json`；Windows窗口、NSIS及WebView2在`tauri.windows.conf.json`；Android标识、最低版本、版本码在`tauri.android.conf.json`。Tauri自动按目标合并。
- Android标识`com.local.fpvendurance`，测试版后缀`.debug`，版本名0.7.4、当前发行版本码7005。与Windows原标识分开；未来更新须提高版本码。
- Android工程在`src-tauri/gen/android`，已纳入可维护源码；不要再次运行init覆盖MainActivity、Manifest、Gradle配置及图标。生成的绝对路径、缓存和SO不纳入Git。
- Android仅Kotlin处理窗口、系统栏和返回键；无数据持久化。返回键先处理IME，再确认退出；系统栏采用适合浅色背景的深色图标。进程存活时切后台及旋转保持表单；关闭、重载或系统回收进程后输入清空。
- 小屏成功计算滚动到结果，校验失败聚焦首个错误。数值保留字符串；温度允许完整键盘输入负号，可选数值提供“未知”按钮。

## 支持范围

安装门槛Android 9／API28，打包包含arm64-v8a及x86_64；未包含32位ARM／x86。编译与target SDK36。页面目标Chromium111及以上；使用手机已安装的系统WebView，不捆绑独立WebView，也不沿用Windows WebView2结论。最低版本只是安装门槛，不能据此宣称Android9到最新版本全部实测通过。已验证设备及WebView版本见交付验收。

## 本机工具链与构建

沿用Tauri CLI2.12.3、Rust Tauri2.12.4及现有npm／Cargo锁，不升级全部依赖。Java为已安装Zulu17；SDK command-line tools13.0、platforms36／35、build-tools36.0.0、NDK27.2.12479018；Gradle9.6.1／AGP9.3.1／Kotlin2.2.10沿用当前Tauri模板。AGP9.3官方兼容JDK17、Gradle9.5以上及build-tools36。

`.tools/android`保存开发SDK、日志与快照；`scripts/Use-AndroidToolchain.ps1`仅设置当前进程环境。NDK实文件位于当前用户的`.fpv-endurance/ndk/27.2.12479018`；同目录下的SDK、Cargo和Rustup英文路径别名指向本项目工具。`android-target`及Gradle缓存也在该私有开发目录。英文sysroot解决Windows LLVM响应文件的中文路径问题；未修改全局PATH或系统开发者模式。

```powershell
. .\scripts\Use-Toolchain.ps1
npm.cmd test
npm.cmd run check
npm.cmd run test:ui
npm.cmd run android:build -- -Mode Debug
# 仅在测试APK验证后生成发行包
npm.cmd run android:build -- -Mode Release
```

构建会从权威原文件刷新`mobile-resources/licenses`、验证匿名库、运行计算测试，再调用Tauri完成前端、原生库和Android glue生成。当前Windows没有文件符号链接权限；`Build-AndroidNative.ps1`只对明确的此类失败采用普通文件复制：先逐ABI成功编译SO，再由工程BuildTask复制到jniLibs并执行Gradle。其他失败必须中止，不能拿旧SO冒充成功。本项目为两个ABI配置16KB最大页对齐，仍需以APK检查与设备验证为准。Windows构建继续使用原`desktop:build`，本任务只做no-bundle兼容构建。

换机必须重新准备SDK／NDK、Rust目标、英文工具路径别名；不能假定本机的`.tools`或私有目录已经存在。没有全新工具链的自动安装脚本。

## 签名与秘密

用户明确授权新建专用发行密钥。`Use-AndroidSigning.ps1`在项目外的当前用户`.fpv-endurance/signing`保存稳定JKS及Windows DPAPI加密密码；目录限制为当前用户。密码仅通过当前进程环境交给keytool／Gradle，构建结束清除。任何JKS、密码、加密密码文件都不进入Git或APK。

测试签名和发行签名不同，应用ID也不同，可并存；测试版不能直接覆盖成为发行版。后续发行版使用相同ID、同一发行密钥且提高versionCode才能覆盖升级。请私下备份密钥和可恢复密码；DPAPI文件绑定Windows用户环境，不能当作跨电脑密码备份。不得因为密码不可用而自动替换已有发行密钥。

## 离线与许可

正式APK装载Tauri内嵌前端、字体和静态参考库；没有Vite、CDN、账号或联网AI依赖。正式Manifest不声明INTERNET；测试构建仅为调试保留该权限。最终合并权限以APK检查记录为准。

两份独立许可实际进入APK的`assets/licenses/`：参考库`reference-library-0.1.0-LICENSE-ATTRIBUTION.md`、字体`LXGW-WenKai-OFL.txt`；发行目录另附原文。匿名数据行不增加来源／产品身份，unknown不修改。

## 验证与边界

共用计算、移动页面、Windows实际重建EXE、Android模拟器和真实手机分开记录。`scripts/android-emulator-check.mjs`仅选择`emulator-5554`，不会向真实手机安装；它验证工况对比、可选值、范围、软键盘、返回、旋转、后台及飞行模式冷启动。Node/domain对照由`android-parity-fixtures.ts`生成，不用本次实际数据反推参考值。

程序测试不是实机续航精度校准。没有真实手机时交付仍应注明未完成真机验收；不能从API35模拟器推断全部系统、厂商WebView、16KB页面设备、低内存设备及全部输入法兼容。

官方依据：[Tauri前置要求](https://v2.tauri.app/start/prerequisites/)、[平台配置](https://v2.tauri.app/reference/config/)、[Android签名](https://v2.tauri.app/distribute/sign/android/)、[Android WebView](https://v2.tauri.app/reference/webview-versions/)、[AGP9.3兼容表](https://developer.android.com/build/releases/agp-9-3-0-release-notes)。
