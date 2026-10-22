param([ValidateSet('Debug','Release')][string]$Mode = 'Debug')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
. "$PSScriptRoot/Use-AndroidToolchain.ps1"
# Tauri CLI performs the frontend/native build and regenerates Android glue.
# Copy mode only handles its specific symlink failure; all other errors fail closed.
$taskCliBase = @('run','tauri','--','android','build','--apk','--ci')
if ($Mode -eq 'Debug') { $taskCliBase += '--debug' }
foreach ($taskAbi in @('aarch64','x86_64')) {
    $taskLog = Join-Path $taskRoot ".tools/android/native-$($Mode.ToLowerInvariant())-$taskAbi.log"
    $ErrorActionPreference = 'Continue'
    & npm.cmd @taskCliBase --target $taskAbi *> $taskLog
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) {
        $taskFailure = Get-Content -LiteralPath $taskLog -Raw -Encoding UTF8
        if ($taskFailure -notmatch 'Creation symbolic link is not allowed for this system') {
            throw "Tauri native build failed; inspect $taskLog"
        }
        Write-Output "Native $taskAbi compiled; using regular file copy instead of a symbolic link."
    }
}
$env:FPV_ANDROID_PREBUILT_DIR = $env:CARGO_TARGET_DIR
try {
    Push-Location src-tauri/gen/android
    try {
        & .\gradlew.bat --no-daemon --no-configuration-cache '-PabiList=arm64-v8a,x86_64' '-ParchList=arm64,x86_64' '-PtargetList=aarch64,x86_64' "assembleUniversal$Mode"
        if ($LASTEXITCODE -ne 0) { throw 'Gradle APK build failed.' }
    } finally { Pop-Location }
} finally { Remove-Item Env:FPV_ANDROID_PREBUILT_DIR -ErrorAction SilentlyContinue }
