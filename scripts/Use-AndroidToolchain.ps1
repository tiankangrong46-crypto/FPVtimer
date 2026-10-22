# Dot-source: local Android tools only; never changes global environment.
. "$PSScriptRoot/Use-Toolchain.ps1"
$taskAndroidRoot = Join-Path (Split-Path -Parent $PSScriptRoot) '.tools/android'
$env:ANDROID_HOME = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.fpv-endurance/android-sdk'
$env:NDK_HOME = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.fpv-endurance/ndk/27.2.12479018'
$env:GRADLE_USER_HOME = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.fpv-endurance/gradle'
$env:CARGO_TARGET_DIR = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.fpv-endurance/android-target'
if (-not $env:JAVA_HOME) {
    $taskJavac = (Get-Command javac.exe -ErrorAction Stop).Source
    $env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $taskJavac)
}
$env:PATH = "$env:JAVA_HOME/bin;$env:ANDROID_HOME/platform-tools;$env:ANDROID_HOME/cmdline-tools/13.0/bin;$env:PATH"
if (-not (Test-Path -LiteralPath "$env:NDK_HOME/source.properties")) { throw "Android NDK not found: $env:NDK_HOME" }
# LLVM's Windows linker cannot read non-ASCII response-file paths reliably.
# These junctions point to this project's existing tools; no global PATH edits.
$env:RUSTUP_HOME = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.fpv-endurance/rustup'
$env:CARGO_HOME = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.fpv-endurance/cargo'
$env:PATH = "$env:CARGO_HOME/bin;$env:PATH"
# Explicit ASCII sysroot avoids rustup resolving the original Chinese tool path.
$taskAndroidSysroot = Join-Path $env:RUSTUP_HOME 'toolchains/stable-x86_64-pc-windows-msvc'
$env:RUSTFLAGS = "--sysroot=$taskAndroidSysroot -C link-arg=-Wl,-z,max-page-size=16384"
$env:CARGO_BUILD_JOBS = '6'
