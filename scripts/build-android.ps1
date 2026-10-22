param([ValidateSet('Debug','Release')][string]$Mode = 'Debug')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
. "$PSScriptRoot/Use-AndroidToolchain.ps1"
$taskVersion = (Get-Content package.json -Raw -Encoding UTF8 | ConvertFrom-Json).version
$taskVersionCode = (Get-Content src-tauri/tauri.android.conf.json -Raw -Encoding UTF8 | ConvertFrom-Json).bundle.android.versionCode
$taskReleaseName = "$taskVersion-build$taskVersionCode"
$taskOutput = Join-Path $taskRoot "Android/v$taskReleaseName"
New-Item -ItemType Directory -Force $taskOutput | Out-Null
# Refresh license assets from their authoritative originals on every build.
$taskLicenses = Join-Path $taskRoot 'mobile-resources/licenses'
New-Item -ItemType Directory -Force $taskLicenses | Out-Null
Copy-Item -LiteralPath 'reference-library/v0.1.0/LICENSE-ATTRIBUTION.md' -Destination "$taskLicenses/reference-library-0.1.0-LICENSE-ATTRIBUTION.md"
Copy-Item -LiteralPath 'src/assets/fonts/OFL.txt' -Destination "$taskLicenses/LXGW-WenKai-OFL.txt"
node reference-library/v0.1.0/tools/validate.mjs
if ($LASTEXITCODE -ne 0) { throw 'Reference validation failed.' }
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Calculation tests failed.' }
try {
    if ($Mode -eq 'Release') { . "$PSScriptRoot/Use-AndroidSigning.ps1" }
    & "$PSScriptRoot/Build-AndroidNative.ps1" -Mode $Mode
    $taskVariant = $Mode.ToLowerInvariant()
    $taskApk = Join-Path $taskRoot "src-tauri/gen/android/app/build/outputs/apk/universal/$taskVariant/app-universal-$taskVariant.apk"
    if (-not (Test-Path -LiteralPath $taskApk)) { throw "Expected APK missing: $taskApk" }
    $taskDestination = Join-Path $taskOutput "FPV-Endurance-$taskReleaseName-android-$taskVariant.apk"
    Copy-Item -LiteralPath $taskApk -Destination $taskDestination
    Copy-Item -LiteralPath "$taskLicenses/reference-library-0.1.0-LICENSE-ATTRIBUTION.md" -Destination "$taskOutput/LICENSE-ATTRIBUTION.md"
    Copy-Item -LiteralPath "$taskLicenses/LXGW-WenKai-OFL.txt" -Destination "$taskOutput/LXGW-WenKai-OFL.txt"
    & "$env:ANDROID_HOME/build-tools/36.0.0/apksigner.bat" verify --verbose --print-certs $taskDestination
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    $taskStream = [IO.File]::OpenRead($taskDestination)
    $taskSha = [Security.Cryptography.SHA256]::Create()
    try { Write-Output ([BitConverter]::ToString($taskSha.ComputeHash($taskStream)).Replace('-','') + '  ' + $taskDestination) }
    finally { $taskStream.Dispose(); $taskSha.Dispose() }
} finally {
    Remove-Item Env:FPV_ANDROID_KEYSTORE,Env:FPV_ANDROID_STORE_PASSWORD,Env:FPV_ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue
}
