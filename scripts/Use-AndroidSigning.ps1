# Load existing signing material, or create a stable app-specific key outside Git.
. "$PSScriptRoot/Use-AndroidToolchain.ps1"
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1') -Force
$taskPrivateDir = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.fpv-endurance/signing'
$taskKeyPath = Join-Path $taskPrivateDir 'android-release.jks'
$taskPasswordPath = Join-Path $taskPrivateDir 'android-password.dpapi'
if (-not (Test-Path -LiteralPath $taskKeyPath)) {
    if (Test-Path -LiteralPath $taskPasswordPath) { throw 'Partial signing material exists; refusing to replace it.' }
    New-Item -ItemType Directory -Force $taskPrivateDir | Out-Null
    $taskSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    & icacls.exe $taskPrivateDir /inheritance:r /grant:r "*${taskSid}:(OI)(CI)F" *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot restrict signing directory permissions.' }
    $taskRandom = New-Object byte[] 32
    $taskRng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $taskRng.GetBytes($taskRandom) } finally { $taskRng.Dispose() }
    $taskSecret = [BitConverter]::ToString($taskRandom).Replace('-','')
    ConvertTo-SecureString $taskSecret -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $taskPasswordPath -Encoding ASCII
    $env:FPV_ANDROID_STORE_PASSWORD = $taskSecret
    $env:FPV_ANDROID_KEY_PASSWORD = $taskSecret
    $ErrorActionPreference = 'Continue'
    & "$env:JAVA_HOME/bin/keytool.exe" -genkeypair -keystore $taskKeyPath -storetype JKS -alias fpv-endurance -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=FPV Endurance Android, O=FPV Endurance, C=CN' -storepass:env FPV_ANDROID_STORE_PASSWORD -keypass:env FPV_ANDROID_KEY_PASSWORD *> $null
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) { throw 'Release key generation failed.' }
    $taskSecret = $null
} else {
    if (-not (Test-Path -LiteralPath $taskPasswordPath)) { throw 'Signing password file missing; preserve the existing key.' }
    $taskSecure = (Get-Content -LiteralPath $taskPasswordPath -Raw).Trim() | ConvertTo-SecureString
    $taskPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecure)
    try {
        $env:FPV_ANDROID_STORE_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPtr)
        $env:FPV_ANDROID_KEY_PASSWORD = $env:FPV_ANDROID_STORE_PASSWORD
    } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPtr) }
}
$env:FPV_ANDROID_KEYSTORE = $taskKeyPath
