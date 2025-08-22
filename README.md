# CT Log Viewer 🚀

A fast, web-based log viewer for analyzing multiple log files side-by-side with advanced features like synchronized scrolling, error highlighting, and cross-file event selection.

![CT Log Viewer](https://img.shields.io/badge/Status-Ready-brightgreen)
![Python](https://img.shields.io/badge/Python-3.7+-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- **📊 Multi-Panel View**: View 3 log files simultaneously
- **🔍 Smart Search**: Search across all files with real-time filtering
- **🔄 Sync Scrolling**: Synchronized scrolling across all panels
- **⚠️ Error Detection**: Automatic error/warning highlighting
- **📍 Scrollbar Indicators**: Visual markers for errors on scrollbars
- **⏰ Event Grouping**: Group events by timestamp
- **🎯 Cross-File Selection**: Select events and see corresponding ones in other files
- **📱 Responsive Design**: Works on desktop and mobile browsers

## 🚀 Quick Start

### Method 1: Clone & Run (Recommended)
```bash
# Clone the repository
git clone https://github.com/yourusername/ctviewer.git
cd ctviewer

# Start the server
python3 server.py

# Open your browser to: http://localhost:8000
```

### Method 2: Download & Run
1. **Download** the repository as ZIP
2. **Extract** to a folder
3. **Run** `python3 server.py`
4. **Open** browser to `http://localhost:8000`

### Method 3: One-Line Install (Linux/Mac)
```bash
curl -sSL https://raw.githubusercontent.com/yourusername/ctviewer/main/install.sh | bash
```

## 📁 Setup Your Log Files

Place your log files in the `data/` folder:

```
data/
├── bt_log_2025-06-02.txt    # BodyTom Scanner logs
├── rs_log_2025-06-02.txt    # RSScanner logs
└── out.log20250602.txt       # Output logs
```

**File Naming Convention:**
- `bt_log_YYYY-MM-DD.txt` - BodyTom Scanner
- `rs_log_YYYY-MM-DD.txt` - RSScanner  
- `out.logYYYYMMDD.txt` - Output logs

## 🎮 Usage

### Basic Navigation
- **Scroll**: Use mouse wheel or scrollbars
- **Search**: Type in any search box to filter logs
- **Sync Scroll**: Toggle to keep all panels synchronized
- **Group by Second**: Toggle to group events by timestamp

### Advanced Features
- **Error Navigation**: Click red/orange dots on scrollbars to jump to errors
- **Cross-File Selection**: Click any event group to highlight corresponding events in other files
- **Auto-Scroll**: Automatically scroll to selected groups

### Keyboard Shortcuts
- `Ctrl+F` / `Cmd+F`: Focus search box
- `Ctrl+Enter` / `Cmd+Enter`: Search across all files
- `Ctrl+S` / `Cmd+S`: Export filtered results

## 🛠️ System Requirements

- **Python**: 3.7 or higher
- **Browser**: Modern web browser (Chrome, Firefox, Safari, Edge)
- **OS**: Windows 10+, macOS 10.14+, or Linux
- **Memory**: 100MB+ available RAM
- **Storage**: 50MB+ free space

## 📦 Installation

### Prerequisites
```bash
# Check Python version
python3 --version

# If Python not installed, download from python.org
```

### Step-by-Step
1. **Clone** the repository
2. **Navigate** to the folder
3. **Start** the server: `python3 server.py`
4. **Open** browser to `http://localhost:8000`

## 🔧 Configuration

### Change Port
Edit `server.py` line 20:
```python
PORT = 8000  # Change to any available port
```

### Custom File Paths
Edit `server.py` to change default data directory:
```python
DATA_DIR = "path/to/your/logs"
```

## 🐛 Troubleshooting

### Common Issues

**Port Already in Use:**
```bash
# Find what's using port 8000
lsof -i :8000  # Mac/Linux
netstat -an | findstr :8000  # Windows

# Kill the process or change port in server.py
```

**Python Not Found:**
```bash
# Try these commands
python server.py
python3 server.py
py server.py  # Windows
```

**Permission Denied:**
```bash
# Mac/Linux
chmod +x start.sh
sudo ./start.sh

# Windows: Run as Administrator
```

**Browser Issues:**
- Clear browser cache
- Try different browser
- Check firewall settings

### Debug Mode
Add debug logging by editing `server.py`:
```python
DEBUG = True  # Set to True for verbose logging
```

## 🚀 Performance Tips

- **Large Files**: The viewer automatically handles large files with streaming
- **Memory Usage**: Only loads visible content to keep memory low
- **Search Speed**: Server-side search for fast results
- **Scroll Performance**: Optimized rendering for smooth scrolling

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature-name`
3. **Commit** your changes: `git commit -am 'Add feature'`
4. **Push** to branch: `git push origin feature-name`
5. **Submit** a pull request

## 📝 Development

### Project Structure
```
ctviewer/
├── server.py          # Python HTTP server
├── index.html         # Web interface
├── styles.css         # Styling
├── script.js          # JavaScript logic
├── data/              # Log files directory
├── build_executable.py # PyInstaller build script
└── create_package.py  # Distribution package script
```

### API Endpoints
- `GET /api/logs?panel=bt&offset=0&limit=50` - Get log lines
- `GET /api/search?q=error` - Search across all files
- `GET /api/stats` - Get file statistics
- `GET /api/errors?panel=bt` - Get error positions

### Building Executables
```bash
# Create standalone executable
python3 build_executable.py

# Create distribution package
python3 create_package.py
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Python standard library
- Web interface using vanilla HTML/CSS/JavaScript
- Inspired by the need for efficient log analysis

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/ctviewer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ctviewer/discussions)
- **Email**: your.email@example.com

---

**⭐ Star this repository if it helped you!**

**🔄 Check for updates regularly to get the latest features and bug fixes.** 