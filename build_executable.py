#!/usr/bin/env python3
"""
Build script for CT Log Viewer executable
Uses PyInstaller to create a standalone executable
"""

import os
import sys
import subprocess
import shutil

def install_pyinstaller():
    """Install PyInstaller if not already installed"""
    try:
        import PyInstaller
        print("PyInstaller already installed")
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        print("PyInstaller installed successfully")

def build_executable():
    """Build the executable using PyInstaller"""
    
    # PyInstaller command
    cmd = [
        "pyinstaller",
        "--onefile",                    # Single executable file
        "--windowed",                   # No console window (for Mac/Windows)
        "--name=CTLogViewer",           # Executable name
        "--add-data=data:data",         # Include data directory
        "--icon=icon.ico",              # Icon file (if you have one)
        "server.py"                     # Main script
    ]
    
    # Remove icon flag if no icon file exists
    if not os.path.exists("icon.ico"):
        cmd = [arg for arg in cmd if not arg.startswith("--icon")]
    
    print("Building executable...")
    print(f"Command: {' '.join(cmd)}")
    
    try:
        subprocess.check_call(cmd)
        print("\n✅ Build successful!")
        print("Executable created in: dist/CTLogViewer")
        
        # Copy data directory to dist
        if os.path.exists("data"):
            shutil.copytree("data", "dist/data", dirs_exist_ok=True)
            print("Data directory copied to: dist/data")
        
        print("\n📁 Distribution package ready in: dist/")
        print("Send the entire 'dist' folder to others!")
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Build failed: {e}")
        return False
    
    return True

def create_readme():
    """Create a README file for the distribution"""
    readme_content = """# CT Log Viewer

A fast, web-based log viewer for analyzing multiple log files side-by-side.

## Features
- View 3 log files simultaneously
- Search and filter logs
- Synchronized scrolling across panels
- Error highlighting and navigation
- Group events by timestamp
- Cross-file event selection

## How to Use
1. Double-click `CTLogViewer` to start the application
2. Open your web browser and go to: http://localhost:8000
3. Place your log files in the `data` folder:
   - `bt_log_YYYY-MM-DD.txt` (BodyTom Scanner)
   - `rs_log_YYYY-MM-DD.txt` (RSScanner)
   - `out.logYYYYMMDD.txt` (Output Log)

## System Requirements
- Windows 10+ / macOS 10.14+ / Linux
- No Python installation required
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Troubleshooting
- If the app doesn't start, try running from command line
- Make sure port 8000 is not in use
- Check that log files are in the data folder
- Ensure log files have .txt extension

## Support
For issues or questions, contact the developer.
"""
    
    with open("dist/README.txt", "w") as f:
        f.write(readme_content)
    
    print("README.txt created in: dist/")

if __name__ == "__main__":
    print("🚀 CT Log Viewer - Executable Builder")
    print("=" * 40)
    
    # Install PyInstaller if needed
    install_pyinstaller()
    
    # Build the executable
    if build_executable():
        create_readme()
        print("\n🎉 Ready to distribute!")
        print("\nTo send to someone:")
        print("1. Zip the 'dist' folder")
        print("2. Send the zip file")
        print("3. They extract and run CTLogViewer")
    else:
        print("\n❌ Build failed. Check the error messages above.") 