#!/usr/bin/env python3
"""
Build script for creating Profession Archives desktop executable
Builds frontend and packages backend + frontend into a single exe using PyInstaller
Located in dev-tools to keep repo root minimal
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path


def run_command(cmd, cwd=None, shell=True):
    """Run shell command and return success status"""
    print(f"\n{'='*60}")
    print(f"Running: {cmd}")
    print(f"{'='*60}\n")
    
    result = subprocess.run(cmd, cwd=cwd, shell=shell)
    return result.returncode == 0


def build_frontend():
    """Build Vue frontend"""
    project_root = Path(__file__).parent.parent
    frontend_dir = project_root / "frontend"
    
    print("\n[1/4] Building frontend...")
    
    # Check if node_modules exists
    if not (frontend_dir / "node_modules").exists():
        if not run_command("npm install", cwd=frontend_dir):
            print("[ERROR] Failed to install frontend dependencies")
            return False
    
    # Build frontend
    if not run_command("npm run build", cwd=frontend_dir):
        print("[ERROR] Failed to build frontend")
        return False
    
    print("[OK] Frontend built successfully")
    return True


def check_python_packages():
    """Check and install required Python packages"""
    print("\n[2/4] Checking Python packages...")

    # Ensure required build packages are installed in current Python environment.
    if not run_command(f"\"{sys.executable}\" -m pip install --upgrade pyinstaller pywebview"):
        print("[ERROR] Failed to install Python build dependencies")
        return False
    
    print("[OK] All Python packages available")
    return True


def build_exe():
    """Build executable using PyInstaller"""
    print("\n[3/4] Building executable with PyInstaller...")
    
    project_root = Path(__file__).parent.parent
    dist_dir = project_root / "dist"
    add_data_sep = ";" if os.name == "nt" else ":"

    icon_arg = ""
    icon_path = project_root / "assets" / "app.ico"
    if icon_path.exists():
        icon_arg = f" --icon=\"{icon_path}\""
    
    # PyInstaller command
    pyinstaller_cmd = (
        f"\"{sys.executable}\" -m PyInstaller "
        f"--onefile "
        f"--windowed "
        f"--name ProfessionArchives "
        f"--add-data \"frontend/dist{add_data_sep}frontend/dist\" "
        f"--add-data \"backend{add_data_sep}backend\" "
        f"{icon_arg} "
        f"--hidden-import=fastapi "
        f"--hidden-import=uvicorn "
        f"--hidden-import=webview "
        f"--collect-all webview "
        f"backend/desktop.py"
    )
    
    if not run_command(pyinstaller_cmd, cwd=project_root):
        print("[ERROR] PyInstaller build failed")
        return False
    
    # Check if exe was created
    exe_path = dist_dir / "ProfessionArchives.exe"
    if exe_path.exists():
        print(f"[OK] Executable created: {exe_path}")
        return True
    else:
        print("[ERROR] Executable not found")
        return False


def cleanup():
    """Clean up build artifacts"""
    print("\n[4/4] Cleaning up...")
    
    project_root = Path(__file__).parent.parent
    build_dir = project_root / "build"
    spec_file = project_root / "ProfessionArchives.spec"
    
    if build_dir.exists():
        shutil.rmtree(build_dir)
        print(f"[OK] Removed build directory")
    
    if spec_file.exists():
        spec_file.unlink()
        print(f"[OK] Removed spec file")


def main():
    """Main build process"""
    print("\n" + "="*60)
    print("Profession Archives Desktop Application Builder")
    print("="*60)
    
    project_root = Path(__file__).parent.parent
    
    # Step 1: Build frontend
    if not build_frontend():
        print("\n[FATAL] Frontend build failed")
        return 1
    
    # Step 2: Check Python packages
    if not check_python_packages():
        print("\n[FATAL] Python setup failed")
        return 1
    
    # Step 3: Build exe
    if not build_exe():
        print("\n[FATAL] Executable build failed")
        return 1
    
    # Step 4: Cleanup
    cleanup()
    
    exe_path = project_root / "dist" / "ProfessionArchives.exe"
    print("\n" + "="*60)
    print(f"✓ Build complete!")
    print(f"Executable location: {exe_path}")
    if exe_path.exists():
        print(f"File size: {exe_path.stat().st_size / (1024*1024):.1f} MB")
    print("="*60)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
