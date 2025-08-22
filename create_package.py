#!/usr/bin/env python3
"""
Create a simple distribution package for CT Log Viewer
No compilation required - just Python files and dependencies
"""

import os
import shutil
import sys

def create_package():
    """Create a distribution package"""
    
    # Create dist directory
    dist_dir = "ctviewer_package"
    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)
    
    os.makedirs(dist_dir)
    os.makedirs(os.path.join(dist_dir, "data"))
    
    # Copy main files
    files_to_copy = [
        "server.py",
        "index.html", 
        "styles.css",
        "script.js"
    ]
    
    for file in files_to_copy:
        if os.path.exists(file):
            shutil.copy2(file, dist_dir)
            print(f"✅ Copied {file}")
        else:
            print(f"⚠️  Warning: {file} not found")
    
    # Copy data directory
    if os.path.exists("data"):
        for item in os.listdir("data"):
            src = os.path.join("data", item)
            dst = os.path.join(dist_dir, "data", item)
            if os.path.isfile(src):
                shutil.copy2(src, dst)
            else:
                shutil.copytree(src, dst)
        print("✅ Copied data directory")
    
    # Create launcher scripts
    create_launcher_scripts(dist_dir)
    
    # Create requirements.txt
    create_requirements(dist_dir)
    
    # Create README
    create_readme(dist_dir)
    
    print(f"\n🎉 Package created in: {dist_dir}/")
    print("📦 To distribute:")
    print("   1. Zip the folder")
    print("   2. Send the zip file")
    print("   3. Recipient extracts and runs launcher")

def create_launcher_scripts(dist_dir):
    """Create launcher scripts for different platforms"""
    
    # Windows batch file
    windows_launcher = """@echo off
echo Starting CT Log Viewer...
echo.
echo Make sure you have Python 3.7+ installed
echo If Python is not in PATH, you may need to run: python server.py
echo.
python server.py
pause
"""
    
    with open(os.path.join(dist_dir, "start.bat"), "w") as f:
        f.write(windows_launcher)
    
    # macOS/Linux shell script
    unix_launcher = """#!/bin/bash
echo "Starting CT Log Viewer..."
echo ""
echo "Make sure you have Python 3.7+ installed"
echo "If Python is not in PATH, you may need to run: python3 server.py"
echo ""
python3 server.py
"""
    
    with open(os.path.join(dist_dir, "start.sh"), "w") as f:
        f.write(unix_launcher)
    
    # Make shell script executable
    os.chmod(os.path.join(dist_dir, "start.sh"), 0o755)
    
    print("✅ Created launcher scripts")

def create_requirements(dist_dir):
    """Create requirements.txt with minimal dependencies"""
    requirements = """# CT Log Viewer Requirements
# Install with: pip install -r requirements.txt

# No external dependencies required!
# Uses only Python standard library modules:
# - http.server
# - socketserver  
# - urllib.parse
# - json
# - os
# - re
"""
    
    with open(os.path.join(dist_dir, "requirements.txt"), "w") as f:
        f.write(requirements)
    
    print("✅ Created requirements.txt")

def create_readme(dist_dir):
    """Create README file"""
    readme = """# CT Log Viewer - Distribution Package

A fast, web-based log viewer for analyzing multiple log files side-by-side.

## Quick Start

### Windows:
1. Double-click `start.bat`
2. Open browser to http://localhost:8000

### macOS/Linux:
1. Double-click `start.sh` or run `./start.sh` in terminal
2. Open browser to http://localhost:8000

## Manual Start (if launchers don't work):
1. Open terminal/command prompt
2. Navigate to this folder
3. Run: `python server.py` (or `python3 server.py`)
4. Open browser to http://localhost:8000

## Features
- View 3 log files simultaneously
- Search and filter logs  
- Synchronized scrolling across panels
- Error highlighting and navigation
- Group events by timestamp
- Cross-file event selection

## File Structure
```
ctviewer_package/
├── server.py          # Python server
├── index.html         # Web interface
├── styles.css         # Styling
├── script.js          # JavaScript logic
├── data/              # Place your log files here
├── start.bat          # Windows launcher
├── start.sh           # macOS/Linux launcher
└── requirements.txt   # Dependencies (none required)
```

## Adding Your Log Files
Place your log files in the `data` folder:
- `bt_log_YYYY-MM-DD.txt` (BodyTom Scanner)
- `rs_log_YYYY-MM-DD.txt` (RSScanner)  
- `out.logYYYYMMDD.txt` (Output Log)

## System Requirements
- Python 3.7 or higher
- Modern web browser
- Windows 10+ / macOS 10.14+ / Linux

## Troubleshooting
- **Port 8000 in use**: Change port in server.py or close other apps
- **Python not found**: Install Python from python.org
- **Permission denied**: Run launcher as administrator (Windows) or with sudo (Linux/Mac)

## Support
For issues or questions, contact the developer.
"""
    
    with open(os.path.join(dist_dir, "README.txt"), "w") as f:
        f.write(readme)
    
    print("✅ Created README.txt")

if __name__ == "__main__":
    print("📦 CT Log Viewer - Package Creator")
    print("=" * 40)
    create_package() 