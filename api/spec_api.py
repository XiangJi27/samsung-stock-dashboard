#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Spec Review API - Simple HTTP server for reviewing spec drafts

Usage:
    python api/spec_api.py
    # Server runs on http://localhost:5000
"""

import json
import os
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse


class SpecReviewHandler(SimpleHTTPRequestHandler):
    """HTTP handler for spec review operations"""

    DRAFTS_DIR = Path("data/spec_drafts")

    def do_GET(self):
        parsed = urlparse(self.path)
        
        if parsed.path == "/api/drafts":
            self.list_drafts()
        elif parsed.path.startswith("/api/draft/"):
            draft_id = parsed.path.split("/")[-1]
            self.get_draft(draft_id)
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length)
        
        if parsed.path == "/api/approve":
            data = json.loads(body)
            self.approve_draft(data['draftId'])
        elif parsed.path == "/api/reject":
            data = json.loads(body)
            self.reject_draft(data['draftId'])
        else:
            self.send_error(404)

    def list_drafts(self):
        """Return list of all draft files"""
        try:
            drafts = []
            for file in self.DRAFTS_DIR.glob("draft_*.json"):
                with open(file, 'r', encoding='utf-8') as f:
                    draft = json.load(f)
                    drafts.append(draft)
            
            # Sort by creation date (newest first)
            drafts.sort(key=lambda x: x['createdAt'], reverse=True)
            
            self.send_json_response(drafts)
        except Exception as e:
            self.send_error(500, str(e))

    def get_draft(self, draft_id: str):
        """Return single draft by ID"""
        try:
            for file in self.DRAFTS_DIR.glob("draft_*.json"):
                with open(file, 'r', encoding='utf-8') as f:
                    draft = json.load(f)
                    if draft['draftId'] == draft_id:
                        self.send_json_response(draft)
                        return
            
            self.send_error(404, f"Draft {draft_id} not found")
        except Exception as e:
            self.send_error(500, str(e))

    def approve_draft(self, draft_id: str):
        """Approve a draft"""
        try:
            for file in self.DRAFTS_DIR.glob("draft_*.json"):
                with open(file, 'r', encoding='utf-8') as f:
                    draft = json.load(f)
                
                if draft['draftId'] == draft_id:
                    draft['reviewStatus'] = 'APPROVED'
                    draft['approvedAt'] = datetime.now().isoformat()
                    
                    with open(file, 'w', encoding='utf-8') as f:
                        json.dump(draft, f, ensure_ascii=False, indent=2)
                    
                    self.send_json_response({'success': True, 'message': 'Draft approved'})
                    return
            
            self.send_error(404, f"Draft {draft_id} not found")
        except Exception as e:
            self.send_error(500, str(e))

    def reject_draft(self, draft_id: str):
        """Reject a draft"""
        try:
            for file in self.DRAFTS_DIR.glob("draft_*.json"):
                with open(file, 'r', encoding='utf-8') as f:
                    draft = json.load(f)
                
                if draft['draftId'] == draft_id:
                    draft['reviewStatus'] = 'REJECTED'
                    draft['rejectedAt'] = datetime.now().isoformat()
                    
                    with open(file, 'w', encoding='utf-8') as f:
                        json.dump(draft, f, ensure_ascii=False, indent=2)
                    
                    self.send_json_response({'success': True, 'message': 'Draft rejected'})
                    return
            
            self.send_error(404, f"Draft {draft_id} not found")
        except Exception as e:
            self.send_error(500, str(e))

    def send_json_response(self, data):
        """Send JSON response"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))


def main():
    port = 5000
    server = HTTPServer(('localhost', port), SpecReviewHandler)
    print(f"🚀 Spec Review API running on http://localhost:{port}")
    print(f"📂 Serving drafts from: {SpecReviewHandler.DRAFTS_DIR.absolute()}")
    print("\nEndpoints:")
    print("  GET  /api/drafts       - List all drafts")
    print("  GET  /api/draft/{id}   - Get single draft")
    print("  POST /api/approve      - Approve draft")
    print("  POST /api/reject       - Reject draft")
    print("\nPress Ctrl+C to stop")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n✓ Server stopped")


if __name__ == "__main__":
    main()
