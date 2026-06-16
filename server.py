import http.server
import json
import csv
import os
import socket

# Ensure the server always runs and serves files from the directory containing this script
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

# Dynamically find an available port starting from 8080 to prevent bind failures
def find_free_port(start_port=8080):
    port = start_port
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('', port))
                return port
            except OSError:
                port += 1

PORT = find_free_port(8080)
CSV_FILE = os.path.join(script_dir, 'book_rows.csv')

class LibraryHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching for developer convenience
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/books':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            books = self.read_csv()
            self.wfile.write(json.dumps(books).encode('utf-8'))
        elif self.path in ('/', '/index.html'):
            # Route root requests directly to the template/index.html
            self.path = '/template/index.html'
            super().do_GET()
        elif self.path == '/style.css':
            # Route root stylesheet requests to template/style.css
            self.path = '/template/style.css'
            super().do_GET()
        elif self.path == '/script.js':
            # Route root script requests to template/script.js
            self.path = '/template/script.js'
            super().do_GET()
        else:
            # Fallback to serve static files normally
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/books':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                books = json.loads(post_data.decode('utf-8'))
                self.write_csv(books)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "count": len(books)}).encode('utf-8'))
            except Exception as e:
                print("Write Error:", e)
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def read_csv(self):
        books = []
        if not os.path.exists(CSV_FILE):
            return books
            
        with open(CSV_FILE, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                volumes = []
                if row.get('volumes'):
                    try:
                        volumes = json.loads(row['volumes'])
                    except:
                        # Fallback parsing if JSON array is invalid
                        val = row['volumes'].replace('[','').replace(']','').replace('"','').strip()
                        volumes = [v.strip() for v in val.split(',') if v.strip()]
                
                books.append({
                    "id": int(row.get('id') or 0),
                    "title": row.get('title', ''),
                    "category": row.get('category', ''),
                    "volumes": volumes,
                    "status": row.get('status', 'yellow').strip(),
                    "user_id": row.get('user_id', ''),
                    "last_updated": row.get('last_updated', '')
                })
        return books

    def write_csv(self, books):
        # Match original CSV columns hierarchy:
        # title,category,volumes,user_id,id,last_updated,status
        fieldnames = ['title', 'category', 'volumes', 'user_id', 'id', 'last_updated', 'status']
        
        with open(CSV_FILE, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
            writer.writeheader()
            
            for book in books:
                volumes_str = json.dumps(book.get('volumes', []))
                writer.writerow({
                    'title': book.get('title', ''),
                    'category': book.get('category', ''),
                    'volumes': volumes_str,
                    'user_id': book.get('user_id') or '6f9750bd-eace-4bf7-92d2-068033cc1bb7',
                    'id': book.get('id', 0),
                    'last_updated': book.get('last_updated', ''),
                    'status': book.get('status', 'yellow')
                })

if __name__ == '__main__':
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, LibraryHandler)
    print(f"Server started on http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass