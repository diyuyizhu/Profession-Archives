@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "PYTHON=%ROOT%\.venv\Scripts\python.exe"
set "DESKTOP_DIR=%ROOT%desktop"
set "PORTABLE_NODE=%ROOT%tools\node\node.exe"
set "PORTABLE_NPM=%ROOT%tools\node\npm.cmd"
set "PORTABLE_NODE_DIR=%ROOT%tools\node"
set "PORTABLE_RUST_HOME=%ROOT%tools\rust"
set "PORTABLE_CARGO_HOME=%PORTABLE_RUST_HOME%\cargo"
set "PORTABLE_RUSTUP_HOME=%PORTABLE_RUST_HOME%\rustup"
set "PORTABLE_CARGO=%PORTABLE_CARGO_HOME%\bin\cargo.exe"
set "PORTABLE_RUSTC=%PORTABLE_CARGO_HOME%\bin\rustc.exe"
set "PORTABLE_RUSTUP=%PORTABLE_CARGO_HOME%\bin\rustup.exe"
set "PORTABLE_RUST_BIN=%PORTABLE_CARGO_HOME%\bin"

if not exist "%PYTHON%" (
  echo [ERROR] Missing local Python environment: %PYTHON%
  echo         Run the project setup once to create .venv, then retry.
  exit /b 1
)

if not exist "%DESKTOP_DIR%\package.json" (
  echo [ERROR] Missing desktop project: %DESKTOP_DIR%\package.json
  exit /b 1
)

set "NODE_CMD="
set "NPM_CMD="

for /f "delims=" %%I in ('where node.exe 2^>nul') do (
  set "NODE_CMD=%%I"
  goto :node_detected
)

:node_detected
if defined NODE_CMD (
  for /f "delims=" %%I in ('where npm.cmd 2^>nul') do (
    set "NPM_CMD=%%I"
    goto :npm_detected
  )
  for /f "delims=" %%I in ('where npm 2^>nul') do (
    set "NPM_CMD=%%I"
    goto :npm_detected
  )
)

:npm_detected
if defined NODE_CMD (
  echo [INFO] Using system Node.js: !NODE_CMD!
  if not defined NPM_CMD (
    echo [ERROR] npm was not found alongside the system Node.js installation.
    exit /b 1
  )
  echo [INFO] Using system npm: !NPM_CMD!
) else (
  if not exist "%PORTABLE_NODE%" (
    choice /M "System Node.js not found. Download and install into tools\node"
    if errorlevel 2 (
      echo [ERROR] Node.js is required. Install it system-wide or rerun and confirm the portable download.
      exit /b 1
    )
    echo [INFO] Bootstrapping portable Node.js into tools\node ...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%tools\bootstrap-green.ps1" -NodeOnly
    if errorlevel 1 (
      echo [ERROR] Failed to bootstrap portable Node.js.
      exit /b 1
    )
  )
  set "NODE_CMD=%PORTABLE_NODE%"
  set "NPM_CMD=%PORTABLE_NPM%"
  echo [INFO] Using portable Node.js: !NODE_CMD!
  echo [INFO] Using portable npm: !NPM_CMD!
)

echo [INFO] Node.js toolchain is ready. Checking Rust toolchain...

if /i "%RUN_GREEN_DRY_RUN%"=="1" (
  echo [DRY-RUN] Node command: !NODE_CMD!
  echo [DRY-RUN] npm command: !NPM_CMD!
  echo [DRY-RUN] Rust bin dir: %PORTABLE_RUST_BIN%
  exit /b 0
)

if not exist "%PORTABLE_CARGO%" (
  choice /M "Portable Rust toolchain not found. Download and install into tools\rust"
  if errorlevel 2 (
    echo [ERROR] Portable Rust toolchain is required. Place it under tools\rust\ or rerun and confirm the download.
    exit /b 1
  )
  echo [INFO] Bootstrapping portable Rust toolchain into tools\rust ...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%tools\bootstrap-green.ps1" -RustOnly
  if errorlevel 1 (
    echo [ERROR] Failed to bootstrap portable Rust toolchain.
    exit /b 1
  )
)

set "PATH=%PORTABLE_RUST_BIN%;%PATH%"
if /i "!NODE_CMD!"=="%PORTABLE_NODE%" set "PATH=%PORTABLE_NODE_DIR%;%PATH%"
set "CARGO_HOME=%PORTABLE_CARGO_HOME%"
set "RUSTUP_HOME=%PORTABLE_RUSTUP_HOME%"
set "RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-msvc"

if exist "%PORTABLE_RUSTUP%" (
  "%PORTABLE_RUSTUP%" show active-toolchain >nul 2>nul
  if errorlevel 1 (
    echo [INFO] Configuring portable Rust default toolchain...
    "%PORTABLE_RUSTUP%" default stable
    if errorlevel 1 (
      echo [ERROR] Failed to configure portable Rust default toolchain.
      exit /b 1
    )
  )
)

echo [1/3] Starting backend on http://127.0.0.1:8000 ...
start "Profession Archives Backend" /D "%ROOT%" "%PYTHON%" -m uvicorn backend.app.main:app --reload

echo [2/3] Checking desktop dependencies ...
pushd "%DESKTOP_DIR%"
if not exist "node_modules" (
  echo Installing desktop dependencies with !NPM_CMD!...
  call "!NPM_CMD!" install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    popd
    exit /b 1
  )
)

if not exist "%PORTABLE_CARGO%" (
  echo [ERROR] Portable Cargo is required for the native window.
  echo         Put a portable Rust toolchain under tools\rust\cargo\bin\cargo.exe.
  popd
  exit /b 1
)

if not exist "%PORTABLE_RUSTC%" (
  echo [ERROR] Portable rustc is required for the native window.
  echo         Put a portable Rust toolchain under tools\rust\cargo\bin\rustc.exe.
  popd
  exit /b 1
)

echo [3/3] Launching Tauri desktop window ...
call "!NPM_CMD!" run tauri:dev

popd
endlocal