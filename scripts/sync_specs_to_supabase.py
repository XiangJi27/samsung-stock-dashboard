#!/usr/bin/env python3
"""
Samsung Branch Operations - Sync Product Specs to Supabase Cloud
Usage:
    python scripts/sync_specs_to_supabase.py --all
    python scripts/sync_specs_to_supabase.py --pn SM-S928B
"""

import os
import sys
import json
import urllib.request
import urllib.error

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://anhxzffcmrihymrptsgd.supabase.co").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")

def get_specs_from_js():
    """Extract specs from product_specs_data.js"""
    path = os.path.join(os.path.dirname(__file__), "..", "product_specs_data.js")
    if not os.path.exists(path):
        print(f"Error: {path} not found.")
        return {}
    
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find window.PRODUCT_SPECS_PROFILES = { ... }
    marker = "window.PRODUCT_SPECS_PROFILES = {"
    idx = content.find(marker)
    if idx == -1:
        print("Marker window.PRODUCT_SPECS_PROFILES not found.")
        return {}

    # Simple JSON extraction or node runner
    import subprocess
    cmd = ["node", "-e", f"""
    const fs = require('fs');
    const content = fs.readFileSync('{path.replace('\\', '/')}', 'utf8');
    const window = {{}};
    try {{
      eval(content);
      console.log(JSON.stringify(Object.keys(window.PRODUCT_SPECS_PROFILES || {{}})));
    }} catch(e) {{
      console.error(e.message);
    }}
    """]
    try:
        out = subprocess.check_output(cmd, encoding='utf-8')
        keys = json.loads(out)
        print(f"Discovered {len(keys)} profiles in product_specs_data.js")
        return keys
    except Exception as e:
        print(f"Error evaluating profiles via node: {e}")
        return []

def upsert_spec_to_supabase(record):
    """Upsert single spec to Supabase REST API"""
    url = f"{SUPABASE_URL}/rest/v1/product_specs"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    data = json.dumps(record).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status in (200, 201, 204)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        if e.code == 404:
            print(f"[Supabase 404] Table 'product_specs' does not exist yet. Please run migration SQL.")
            return False
        print(f"[Supabase Error {e.code}]: {body}")
        return False
    except Exception as e:
        print(f"[Network Error]: {e}")
        return False

def main():
    print(f"=== Supabase Spec Sync Utility ===")
    print(f"Target URL: {SUPABASE_URL}")
    keys = get_specs_from_js()
    print(f"Ready to sync. Run migrations in Supabase SQL editor before running full sync.")

if __name__ == "__main__":
    main()
