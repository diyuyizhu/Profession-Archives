@echo off
setlocal

set "ROOT=%~dp0\.."
set "NODE_EXE=%ROOT%\tools\node\node.exe"
set "NPM_CMD=%ROOT%\tools\node\npm.cmd"
set "CARGO_EXE=%ROOT%\tools\rust\cargo\bin\cargo.exe"
set "RUSTC_EXE=%ROOT%\tools\rust\cargo\bin\rustc.exe"
set "PYTHON_EXE=%ROOT%\.venv\Scripts\python.exe"

echo Checking green toolchain layout...

if exist "%PYTHON_EXE%" (
  echo [OK] Python: %PYTHON_EXE%
) else (
  echo [MISSING] Python: %PYTHON_EXE%
)

if exist "%NODE_EXE%" (
  echo [OK] Node: %NODE_EXE%
) else (
  echo [MISSING] Node: %NODE_EXE%
)

if exist "%NPM_CMD%" (
  echo [OK] npm: %NPM_CMD%
) else (
  echo [MISSING] npm: %NPM_CMD%
)

if exist "%CARGO_EXE%" (
  echo [OK] Cargo: %CARGO_EXE%
) else (
  echo [MISSING] Cargo: %CARGO_EXE%
)

if exist "%RUSTC_EXE%" (
  echo [OK] rustc: %RUSTC_EXE%
) else (
  echo [MISSING] rustc: %RUSTC_EXE%
)

if not exist "%PYTHON_EXE%" exit /b 1
if not exist "%NODE_EXE%" exit /b 1
if not exist "%NPM_CMD%" exit /b 1
if not exist "%CARGO_EXE%" exit /b 1
if not exist "%RUSTC_EXE%" exit /b 1

echo.
echo Green toolchain layout looks ready.
exit /b 0