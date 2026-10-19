# Dot-source this file to use a project-local x64 Node and Rust without changing system PATH.
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
$taskTools = Join-Path $taskProjectRoot '.tools'
$taskLocalNode = Join-Path $taskTools 'node.exe'
$taskLocalCargo = Join-Path $taskTools 'cargo'
if (Test-Path -LiteralPath $taskLocalNode) {
    $taskNpmCommand = Get-Command npm.cmd -ErrorAction Stop
    $taskNpmPath = Join-Path (Split-Path -Parent $taskNpmCommand.Source) 'node_modules\npm\bin\npm-cli.js'
    if (!(Test-Path -LiteralPath $taskNpmPath)) {
        $taskNpmPath = Join-Path ${env:ProgramFiles(x86)} 'nodejs\node_modules\npm\bin\npm-cli.js'
    }
    if (!(Test-Path -LiteralPath $taskNpmPath)) { throw 'npm CLI not found; install x64 Node.js with npm.' }
    # Use a relative batch path so legacy PowerShell/cmd code pages cannot corrupt a Chinese workspace path.
    $taskWrapper = '@echo off' + "`r`n" + '"%~dp0node.exe" "' + $taskNpmPath + '" %*' + "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $taskTools 'npm.cmd'), $taskWrapper, [System.Text.Encoding]::ASCII)
    $env:PATH = $taskTools + ';' + $env:PATH
}
if (Test-Path -LiteralPath (Join-Path $taskLocalCargo 'bin\cargo.exe')) {
    $env:CARGO_HOME = $taskLocalCargo
    $env:RUSTUP_HOME = Join-Path $taskTools 'rustup'
    $env:PATH = (Join-Path $taskLocalCargo 'bin') + ';' + $env:PATH
}
