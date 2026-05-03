param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [switch]$NodeOnly,
  [switch]$RustOnly
)

$ErrorActionPreference = 'Stop'

$nodeDir = Join-Path $Root 'tools\node'
$rustHome = Join-Path $Root 'tools\rust'
$cargoHome = Join-Path $rustHome 'cargo'
$rustupHome = Join-Path $rustHome 'rustup'
$tempDir = Join-Path $Root 'tools\_tmp'

New-Item -ItemType Directory -Force -Path $nodeDir, $cargoHome, $rustupHome, $tempDir | Out-Null

if (-not $RustOnly -and -not (Test-Path (Join-Path $nodeDir 'node.exe'))) {
  $nodeVersion = '22.14.0'
  $nodeArchive = Join-Path $tempDir "node-v$nodeVersion-win-x64.zip"
  $nodeUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip"
  Write-Host "Downloading portable Node.js $nodeVersion ..."
  Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeArchive
  Expand-Archive -Path $nodeArchive -DestinationPath $tempDir -Force
  $nodeSource = Join-Path $tempDir "node-v$nodeVersion-win-x64"
  Copy-Item -Path (Join-Path $nodeSource '*') -Destination $nodeDir -Recurse -Force
}

$cargoExe = Join-Path $cargoHome 'bin\cargo.exe'
$rustcExe = Join-Path $cargoHome 'bin\rustc.exe'

if (-not $NodeOnly -and (-not (Test-Path $cargoExe) -or -not (Test-Path $rustcExe))) {
  $rustupExe = Join-Path $tempDir 'rustup-init.exe'
  $rustupUrl = 'https://win.rustup.rs/x86_64'
  Write-Host 'Downloading rustup installer ...'
  Invoke-WebRequest -Uri $rustupUrl -OutFile $rustupExe

  $env:CARGO_HOME = $cargoHome
  $env:RUSTUP_HOME = $rustupHome
  $env:PATH = "$nodeDir;$($env:PATH)"

  Write-Host 'Installing local Rust toolchain ...'
  & $rustupExe -y --no-modify-path --profile minimal --default-toolchain stable
}

Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
Write-Host 'Portable tools are ready.'
