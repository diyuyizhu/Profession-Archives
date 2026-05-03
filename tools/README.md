# Portable tools layout

This repository prefers the system Node.js installation first, and falls back to local portable toolchains under `tools/` when needed.

Start here:

- `tools/PORTABLE-CHECKLIST.md` for the exact files to place.
- `tools/check-green.bat` for a quick local validation.
- `tools/bootstrap-green.ps1` for download/install after you confirm the prompt.

Required layout:

- `tools/node/node.exe`
- `tools/node/npm.cmd`
- `tools/rust/cargo/bin/cargo.exe`
- `tools/rust/cargo/bin/rustc.exe`

Recommended extras:

- `tools/node/` should contain the full portable Node.js distribution, not just a single executable.
- `tools/rust/` should contain a full portable Rust toolchain extracted from the official Windows archive.

Launch flow:

1. Start the local Python backend from `.venv`.
2. Use system Node.js first, or confirm a portable Node.js download if the system one is missing.
3. Use portable Cargo to compile and run the Tauri window.

If Node.js is available on the system PATH, `run-green.bat` will use it first. If not, it will ask before downloading the portable copy. Rust still uses the portable toolchain under `tools/rust/`.

The launcher asks for confirmation before downloading anything. If you choose not to download, it will stop and let you install the portable toolchains manually.
