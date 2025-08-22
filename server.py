#!/usr/bin/env python3
"""
Enhanced HTTP server for CT Log Viewer
Supports streaming log data and server-side processing
"""

import http.server
import socketserver
import os
import sys
import json
import re
from urllib.parse import urlparse, parse_qs
import mimetypes
from datetime import datetime

class CTLogViewerHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Parse the URL
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query = parse_qs(parsed_url.query)
        
        # Handle API endpoints
        if path.startswith('/api/'):
            self.handle_api_request(path, query)
            return
        
        # Handle root path
        if path == '/':
            path = '/index.html'
        
        # Handle data file requests
        if path.startswith('/data/'):
            # Ensure the file exists and is within the data directory
            file_path = os.path.join(os.getcwd(), path[1:])
            if os.path.exists(file_path) and os.path.isfile(file_path):
                self.send_file_response(file_path)
                return
            else:
                self.send_error(404, "File not found")
                return
        
        # Handle other static files
        file_path = os.path.join(os.getcwd(), path[1:])
        if os.path.exists(file_path) and os.path.isfile(file_path):
            self.send_file_response(file_path)
        else:
            # Try to serve from current directory
            super().do_GET()
    
    def handle_api_request(self, path, query):
        """Handle API requests for streaming log data"""
        if path == '/api/logs':
            self.handle_logs_api(query)
        elif path == '/api/search':
            self.handle_search_api(query)
        elif path == '/api/seconds':
            self.handle_seconds_api(query)
        elif path == '/api/stats':
            self.handle_stats_api(query)
        elif path == '/api/errors':
            self.handle_errors_api(query)
        else:
            self.send_error(404, "API endpoint not found")
    
    def handle_logs_api(self, query):
        """Stream log data with pagination and filtering"""
        try:
            panel = query.get('panel', ['bt'])[0]
            offset = int(query.get('offset', [0])[0])
            limit = int(query.get('limit', [50])[0])
            search = query.get('search', [''])[0]
            second = query.get('second', [''])[0]
            
            file_path = self.get_log_file_path(panel)
            if not file_path or not os.path.exists(file_path):
                self.send_error(404, f"Log file not found for panel {panel}")
                return
            
            # Read and process log data
            if second:
                lines = self.read_log_lines_by_second(file_path, second, limit)
            else:
                lines = self.read_log_lines(file_path, offset, limit, search)
            
            # Send response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                'lines': lines,
                'offset': offset,
                'limit': limit,
                'hasMore': len(lines) == limit
            }
            
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, f"Server error: {str(e)}")
    
    def handle_search_api(self, query):
        """Search across all log files"""
        try:
            search_term = query.get('q', [''])[0]
            if not search_term:
                self.send_error(400, "Search term required")
                return
            
            results = {}
            for panel in ['bt', 'out', 'rs']:
                file_path = self.get_log_file_path(panel)
                if file_path and os.path.exists(file_path):
                    matches = self.search_in_file(file_path, search_term)
                    results[panel] = matches[:100]  # Limit results
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            self.wfile.write(json.dumps(results).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, f"Server error: {str(e)}")
    
    def handle_seconds_api(self, query):
        """Get all unique seconds across all log files"""
        try:
            seconds = set()
            for panel in ['bt', 'out', 'rs']:
                file_path = self.get_log_file_path(panel)
                if file_path and os.path.exists(file_path):
                    file_seconds = self.extract_seconds_from_file(file_path)
                    seconds.update(file_seconds)
            
            sorted_seconds = sorted(list(seconds))
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            self.wfile.write(json.dumps({'seconds': sorted_seconds}).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, f"Server error: {str(e)}")
    
    def extract_seconds_from_file(self, file_path):
        """Extract all unique seconds from a log file"""
        seconds = set()
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    second_key = self.extract_second_key(line)
                    if second_key:
                        seconds.add(second_key)
        except Exception as e:
            print(f"Error extracting seconds from {file_path}: {e}")
        return seconds
    
    def handle_stats_api(self, query):
        """Get statistics about log files"""
        try:
            stats = {}
            for panel in ['bt', 'out', 'rs']:
                file_path = self.get_log_file_path(panel)
                if file_path and os.path.exists(file_path):
                    stats[panel] = self.get_file_stats(file_path)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            self.wfile.write(json.dumps(stats).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, f"Server error: {str(e)}")

    def handle_errors_api(self, query):
        """Get error positions for scrollbar indicators"""
        try:
            panel = query.get('panel', ['bt'])[0]
            file_path = self.get_log_file_path(panel)
            
            if not file_path or not os.path.exists(file_path):
                self.send_error(404, f"Log file not found for panel {panel}")
                return
            
            errors = self.get_error_positions(file_path)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            self.wfile.write(json.dumps(errors).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, f"Server error: {str(e)}")

    def get_error_positions(self, file_path):
        """Get positions of all errors and warnings in a file"""
        errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line_num, line in enumerate(f):
                    line = line.rstrip('\n\r')
                    if not line:
                        continue
                    
                    level = self.detect_log_level(line)
                    if level in ['error', 'warning']:
                        errors.append({
                            'lineNumber': line_num,
                            'level': level,
                            'offset': line_num
                        })
                        
        except Exception as e:
            print(f"Error reading log file {file_path}: {e}")
        
        return errors
    
    def get_log_file_path(self, panel):
        """Get the file path for a given panel"""
        file_map = {
            'bt': 'data/bt_log_2025-06-02.txt',
            'out': 'data/out.log20250602.txt',
            'rs': 'data/rs_log_2025-06-02.txt'
        }
        return file_map.get(panel)
    
    def read_log_lines(self, file_path, offset, limit, search=''):
        """Read log lines with pagination and optional search"""
        lines = []
        line_count = 0
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                # Skip to offset
                for _ in range(offset):
                    if f.readline():
                        line_count += 1
                    else:
                        break
                
                # Read requested lines
                for _ in range(limit):
                    line = f.readline()
                    if not line:
                        break
                    
                    line = line.rstrip('\n\r')
                    if not line:
                        continue
                    
                    # Apply search filter if provided
                    if search and search.lower() not in line.lower():
                        continue
                    
                    # Parse line
                    parsed_line = self.parse_log_line(line, offset + len(lines))
                    lines.append(parsed_line)
                    
                    if len(lines) >= limit:
                        break
                        
        except Exception as e:
            print(f"Error reading log file {file_path}: {e}")
        
        return lines
    
    def read_log_lines_by_second(self, file_path, target_second, limit):
        """Read log lines for a specific second"""
        lines = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line_num, line in enumerate(f):
                    line = line.rstrip('\n\r')
                    if not line:
                        continue
                    
                    # Check if this line matches the target second
                    second_key = self.extract_second_key(line)
                    if second_key == target_second:
                        parsed_line = self.parse_log_line(line, line_num)
                        lines.append(parsed_line)
                        
                        if len(lines) >= limit:
                            break
                            
        except Exception as e:
            print(f"Error reading log file {file_path}: {e}")
        
        return lines
    
    def parse_log_line(self, line, line_number):
        """Parse a single log line and extract metadata"""
        timestamp = self.extract_timestamp(line)
        level = self.detect_log_level(line)
        second_key = self.extract_second_key(line)
        
        return {
            'id': line_number,
            'content': line,
            'timestamp': timestamp,
            'level': level,
            'secondKey': second_key,
            'original': line
        }
    
    def extract_timestamp(self, line):
        """Extract timestamp from log line"""
        patterns = [
            r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})',
            r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})',
            r'(\d{2}:\d{2}:\d{2}\.\d{3})'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                return match.group(1)
        return None
    
    def extract_second_key(self, line):
        """Extract second-level key for grouping"""
        patterns = [
            r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})',
            r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})',
            r'(\d{2}:\d{2}:\d{2})'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                return match.group(1)
        return None
    
    def detect_log_level(self, line):
        """Detect log level from line content"""
        line_lower = line.lower()
        if 'error' in line_lower or 'exception' in line_lower:
            return 'error'
        elif 'warn' in line_lower:
            return 'warning'
        elif 'info' in line_lower or 'debug' in line_lower:
            return 'info'
        return 'normal'
    
    def search_in_file(self, file_path, search_term):
        """Search for term in file and return matching lines"""
        matches = []
        search_lower = search_term.lower()
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line_num, line in enumerate(f):
                    if search_lower in line.lower():
                        parsed_line = self.parse_log_line(line.rstrip('\n\r'), line_num)
                        matches.append(parsed_line)
                        if len(matches) >= 100:  # Limit results
                            break
        except Exception as e:
            print(f"Error searching file {file_path}: {e}")
        
        return matches
    
    def get_file_stats(self, file_path):
        """Get statistics about a log file"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                total_lines = len(lines)
                
                # Count by level
                level_counts = {'error': 0, 'warning': 0, 'info': 0, 'normal': 0}
                for line in lines:
                    level = self.detect_log_level(line)
                    level_counts[level] += 1
                
                return {
                    'totalLines': total_lines,
                    'levelCounts': level_counts,
                    'fileSize': os.path.getsize(file_path)
                }
        except Exception as e:
            print(f"Error getting stats for {file_path}: {e}")
            return {'totalLines': 0, 'levelCounts': {}, 'fileSize': 0}
    
    def send_file_response(self, file_path):
        """Send a file response with proper headers"""
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            
            # Determine content type
            content_type, _ = mimetypes.guess_type(file_path)
            if content_type is None:
                if file_path.endswith('.js'):
                    content_type = 'application/javascript'
                elif file_path.endswith('.css'):
                    content_type = 'text/css'
                elif file_path.endswith('.html'):
                    content_type = 'text/html'
                elif file_path.endswith('.txt'):
                    content_type = 'text/plain'
                else:
                    content_type = 'application/octet-stream'
            
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            self.wfile.write(content)
            
        except Exception as e:
            self.send_error(500, f"Internal server error: {str(e)}")
    
    def log_message(self, format, *args):
        """Override to provide cleaner logging"""
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), format % args))

def main():
    PORT = 8000
    
    # Check if port is available, try next port if not
    for port in range(PORT, PORT + 10):
        try:
            with socketserver.TCPServer(("", port), CTLogViewerHandler) as httpd:
                print(f"Enhanced CT Log Viewer server starting on http://localhost:{port}")
                print("Press Ctrl+C to stop the server")
                print(f"Your log files are located in: {os.path.join(os.getcwd(), 'data')}")
                print("API endpoints available:")
                print("  - /api/logs?panel=bt&offset=0&limit=50")
                print("  - /api/search?q=error")
                print("  - /api/stats")
                httpd.serve_forever()
                break
        except OSError as e:
            if port == PORT + 9:  # Last attempt
                print(f"Could not start server on any port from {PORT} to {PORT + 9}")
                sys.exit(1)
            continue
        except KeyboardInterrupt:
            print("\nServer stopped by user")
            break

if __name__ == "__main__":
    main() 