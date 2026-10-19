$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
. (Join-Path $PSScriptRoot 'Use-Toolchain.ps1')
$taskPackage = Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$taskConfig = Get-Content -LiteralPath (Join-Path $taskRoot 'src-tauri\tauri.conf.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$taskVersion = $taskPackage.version
if ($taskVersion -ne $taskConfig.version) { throw 'Package and Tauri versions must match' }
$taskOutputDir = Join-Path $taskRoot ('outputs\v' + $taskVersion)
New-Item -ItemType Directory -Path $taskOutputDir -Force | Out-Null
& node (Join-Path $taskRoot 'reference-library\v0.1.0\tools\validate.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Reference library validation failed' }
& npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Domain tests failed' }
& npm.cmd run tauri -- build --bundles nsis
if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed' }
$taskInstallerName = $taskConfig.productName + '_' + $taskVersion + '_x64-setup.exe'
$taskInstaller = Get-Item -LiteralPath (Join-Path $taskRoot ('src-tauri\target\release\bundle\nsis\' + $taskInstallerName)) -ErrorAction SilentlyContinue
if (!$taskInstaller) { throw 'Installer not generated' }
Copy-Item -LiteralPath $taskInstaller.FullName -Destination (Join-Path $taskOutputDir ('FPV-Endurance-' + $taskVersion + '-x64-setup.exe'))
Copy-Item -LiteralPath (Join-Path $taskRoot 'src-tauri\target\release\fpv-endurance.exe') -Destination (Join-Path $taskOutputDir ('FPV-Endurance-' + $taskVersion + '.exe'))
Copy-Item -LiteralPath (Join-Path $taskRoot 'reference-library\v0.1.0\LICENSE-ATTRIBUTION.md') -Destination (Join-Path $taskOutputDir 'LICENSE-ATTRIBUTION.md')
Get-ChildItem -LiteralPath $taskOutputDir -Filter '*.exe' | Select-Object Name,Length
