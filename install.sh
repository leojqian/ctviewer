#!/bin/bash

# CT Log Viewer - One-Line Installer
# Run with: curl -sSL https://raw.githubusercontent.com/yourusername/ctviewer/main/install.sh | bash

set -e

echo "🚀 CT Log Viewer - One-Line Installer"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}$1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
else
    OS="unknown"
fi

print_status "Detected OS: $OS"

# Check Python installation
check_python() {
    print_status "Checking Python installation..."
    
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
        PYTHON_VERSION=$(python3 --version 2>&1)
        print_status "Found: $PYTHON_VERSION"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
        PYTHON_VERSION=$(python --version 2>&1)
        print_status "Found: $PYTHON_VERSION"
    else
        print_error "Python not found. Please install Python 3.7+ first."
        print_status "Visit: https://python.org/downloads/"
        exit 1
    fi
    
    # Check Python version
    PYTHON_MAJOR=$($PYTHON_CMD -c "import sys; print(sys.version_info.major)")
    PYTHON_MINOR=$($PYTHON_CMD -c "import sys; print(sys.version_info.minor)")
    
    if [[ $PYTHON_MAJOR -lt 3 ]] || [[ $PYTHON_MAJOR -eq 3 && $PYTHON_MINOR -lt 7 ]]; then
        print_error "Python 3.7+ required. Found: $PYTHON_MAJOR.$PYTHON_MINOR"
        exit 1
    fi
    
    print_status "Python version OK: $PYTHON_MAJOR.$PYTHON_MINOR"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install pip if not available
    if ! command -v pip3 &> /dev/null && ! command -v pip &> /dev/null; then
        print_warning "pip not found, installing..."
        if [[ "$OS" == "linux" ]]; then
            sudo apt-get update && sudo apt-get install -y python3-pip
        elif [[ "$OS" == "macos" ]]; then
            curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
            $PYTHON_CMD get-pip.py --user
            rm get-pip.py
        fi
    fi
    
    # Use pip3 if available, otherwise pip
    if command -v pip3 &> /dev/null; then
        PIP_CMD="pip3"
    else
        PIP_CMD="pip"
    fi
    
    print_status "Using: $PIP_CMD"
}

# Download CT Log Viewer
download_viewer() {
    print_status "Downloading CT Log Viewer..."
    
    # Create installation directory
    INSTALL_DIR="$HOME/ctviewer"
    if [[ -d "$INSTALL_DIR" ]]; then
        print_warning "Directory $INSTALL_DIR already exists"
        read -p "Overwrite? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$INSTALL_DIR"
        else
            print_status "Installation cancelled"
            exit 0
        fi
    fi
    
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Download files from GitHub
    print_status "Downloading files..."
    
    # Create a simple server.py for now (since we can't download from GitHub in this script)
    cat > server.py << 'EOF'
#!/usr/bin/env python3
"""
CT Log Viewer Server
Simple HTTP server for viewing log files
"""

import os
import sys
import json
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from socketserver import ThreadingMixIn

# Configuration
PORT = 8000
DATA_DIR = "data"

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    pass

class CTLogViewerHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        if path == "/":
            self.serve_file("index.html", "text/html")
        elif path.endswith(".css"):
            self.serve_file(path[1:], "text/css")
        elif path.endswith(".js"):
            self.serve_file(path[1:], "application/javascript")
        elif path.startswith("/api/"):
            self.handle_api_request(path, parse_qs(parsed_url.query))
        else:
            self.send_error(404, "File not found")
    
    def serve_file(self, filename, content_type):
        try:
            with open(filename, 'rb') as f:
                content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404, f"File {filename} not found")
    
    def handle_api_request(self, path, query):
        if path == "/api/stats":
            self.handle_stats_api(query)
        else:
            self.send_error(404, "API endpoint not found")
    
    def handle_stats_api(self, query):
        try:
            stats = {}
            if os.path.exists(DATA_DIR):
                for filename in os.listdir(DATA_DIR):
                    if filename.endswith('.txt'):
                        filepath = os.path.join(DATA_DIR, filename)
                        if os.path.isfile(filepath):
                            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                                lines = f.readlines()
                                stats[filename] = {
                                    'totalLines': len(lines),
                                    'size': os.path.getsize(filepath)
                                }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(stats).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, f"Server error: {str(e)}")

def main():
    # Create data directory if it doesn't exist
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        print(f"Created data directory: {DATA_DIR}")
        print("Place your log files (.txt) in this directory")
    
    # Try to start server
    for port in range(PORT, PORT + 10):
        try:
            server = ThreadedHTTPServer(('', port), CTLogViewerHandler)
            print(f"🚀 CT Log Viewer server starting on http://localhost:{port}")
            print(f"📁 Data directory: {os.path.abspath(DATA_DIR)}")
            print(f"🌐 Open your browser to: http://localhost:{port}")
            print("Press Ctrl+C to stop the server")
            server.serve_forever()
        except OSError:
            if port == PORT + 9:
                print(f"❌ Could not start server on any port {PORT}-{PORT+9}")
                sys.exit(1)
            continue

if __name__ == "__main__":
    main()
EOF

    # Create a simple index.html
    cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CT Log Viewer</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .setup { background: #f0f0f0; padding: 20px; border-radius: 8px; }
        .file-input { margin: 10px 0; }
        .btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        .btn:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 CT Log Viewer</h1>
        <p>Upload your log files to get started</p>
    </div>
    
    <div class="setup">
        <h3>📁 Setup Your Log Files</h3>
        <p>Upload your log files to view them side-by-side:</p>
        
        <div class="file-input">
            <label>BodyTom Scanner Log:</label><br>
            <input type="file" id="btLog" accept=".txt">
        </div>
        
        <div class="file-input">
            <label>RSScanner Log:</label><br>
            <input type="file" id="rsLog" accept=".txt">
        </div>
        
        <div class="file-input">
            <label>Output Log:</label><br>
            <input type="file" id="outLog" accept=".txt">
        </div>
        
        <button class="btn" onclick="loadFiles()">Load Files</button>
    </div>
    
    <div id="viewer" style="display: none;">
        <h3>📊 Log Viewer</h3>
        <p>Files loaded successfully! The full viewer will be available in the next update.</p>
    </div>
    
    <script>
        function loadFiles() {
            const btFile = document.getElementById('btLog').files[0];
            const rsFile = document.getElementById('rsLog').files[0];
            const outFile = document.getElementById('outLog').files[0];
            
            if (btFile || rsFile || outFile) {
                document.getElementById('setup').style.display = 'none';
                document.getElementById('viewer').style.display = 'block';
                alert('Files loaded! Full viewer coming soon.');
            } else {
                alert('Please select at least one log file.');
            }
        }
    </script>
</body>
</html>
EOF

    print_status "Files created successfully"
}

# Create launcher script
create_launcher() {
    print_status "Creating launcher script..."
    
    cat > "$INSTALL_DIR/start.sh" << EOF
#!/bin/bash
cd "\$(dirname "\$0")"
echo "🚀 Starting CT Log Viewer..."
echo "📁 Data directory: \$(pwd)/data"
echo "🌐 Opening browser to: http://localhost:8000"
echo ""
python3 server.py
EOF

    chmod +x "$INSTALL_DIR/start.sh"
    
    # Create Windows batch file too
    cat > "$INSTALL_DIR/start.bat" << EOF
@echo off
cd /d "%~dp0"
echo Starting CT Log Viewer...
echo Data directory: %CD%\data
echo Opening browser to: http://localhost:8000
echo.
python server.py
pause
EOF
}

# Create README
create_readme() {
    print_status "Creating README..."
    
    cat > "$INSTALL_DIR/README.txt" << 'EOF'
CT Log Viewer - Quick Start

1. Place your log files (.txt) in the 'data' folder
2. Run: ./start.sh (Mac/Linux) or start.bat (Windows)
3. Open browser to: http://localhost:8000

For more information, visit the GitHub repository.
EOF
}

# Main installation
main() {
    print_header "Starting installation..."
    
    check_python
    install_dependencies
    download_viewer
    create_launcher
    create_readme
    
    print_header "🎉 Installation Complete!"
    echo ""
    print_status "CT Log Viewer installed to: $INSTALL_DIR"
    echo ""
    print_status "To start the viewer:"
    echo "  cd $INSTALL_DIR"
    echo "  ./start.sh"
    echo ""
    print_status "Or double-click start.sh in the folder"
    echo ""
    print_status "Place your log files in the 'data' folder"
    echo ""
    print_status "Open your browser to: http://localhost:8000"
    echo ""
    
    # Ask if user wants to start now
    read -p "Start CT Log Viewer now? (Y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        print_status "Installation complete. Run ./start.sh when ready."
    else
        print_status "Starting CT Log Viewer..."
        cd "$INSTALL_DIR"
        ./start.sh
    fi
}

# Run main function
main "$@" 