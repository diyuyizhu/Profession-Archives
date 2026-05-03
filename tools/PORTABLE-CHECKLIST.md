# Portable Tool Checklist

Put these local, portable toolchains inside the repository before using `run-green.bat`.

## Required files

- `tools/node/node.exe`
- `tools/node/npm.cmd`
- `tools/node/npx.cmd`
- `tools/node/modules/`
- `tools/rust/cargo/bin/cargo.exe`
- `tools/rust/cargo/bin/rustc.exe`
- `tools/rust/rustup/`

## Recommended package sources

- Portable Node.js for Windows, extracted into `tools/node/`.
- Portable Rust toolchain for Windows, extracted into `tools/rust/`.

## Quick verification

1. Confirm `tools/node/node.exe` exists.
2. Confirm `tools/node/npm.cmd` exists.
3. Confirm `tools/rust/cargo/bin/cargo.exe` exists.
4. Confirm `tools/rust/cargo/bin/rustc.exe` exists.
5. Double-click `run-green.bat`.

## What should happen

- The Python backend starts from `.venv`.
- The desktop frontend installs dependencies from portable Node.
- Tauri launches a native window instead of a browser tab.

## If something fails

- Missing Node files: re-extract the Node portable archive into `tools/node/`.
- Missing Rust files: re-extract the Rust portable archive into `tools/rust/` or rerun the bootstrap script.
- Missing `.venv`: recreate the local Python environment first.
