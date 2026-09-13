#!/usr/bin/env python3
"""
Build Dedicated Pilot Entrypoint (pilot.html)
Preserves baseline index.html 100% untouched.
Injects Supabase JS SDK and modular pilot feedback scripts into pilot.html.
"""

import os
import sys
import hashlib

sys.stdout.reconfigure(encoding="utf-8")

def build_pilot_entrypoint():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    index_path = os.path.join(base_dir, "index.html")
    pilot_path = os.path.join(base_dir, "pilot.html")

    # Read binary bytes to verify hash
    with open(index_path, "rb") as f:
        raw_bytes = f.read()

    expected_index_sha = "90fcdaacb7bf77fb59918be8dd155ef5565dc68e7a3ea2694ab5c3139195b70c"
    actual_index_sha = hashlib.sha256(raw_bytes).hexdigest()
    if actual_index_sha != expected_index_sha:
        raise ValueError(f"CRITICAL: index.html sha256 mismatch! Expected {expected_index_sha}, got {actual_index_sha}")

    print("✅ Baseline index.html verified bit-for-bit identical to a7c3390.")

    # Decode text for templating
    content = raw_bytes.decode("utf-8")

    # Injections
    pilot_title = "<title>SAMSUNG Stock & Promotion Dashboard [FEEDBACK PILOT] - Ayutthaya City Park</title>"
    content = content.replace("<title>SAMSUNG Stock & Promotion Dashboard - Copperwired Branch</title>", pilot_title)

    pilot_scripts = """
  <!-- Official Supabase JS SDK CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

  <!-- User Feedback Pilot Modular Components (Ayutthaya City Park - 4-User Store Model) -->
  <script src="assets/js/pilot-runtime-config.js"></script>
  <script src="assets/js/supabase-client.js"></script>
  <script src="assets/js/auth-service.js"></script>
  <script src="assets/js/permission-service.js"></script>
  <script src="assets/js/session-guard.js"></script>
  <script src="assets/js/issue-service.js"></script>
  <script src="assets/js/auth-modal.js"></script>
  <script src="assets/js/user-status-bar.js"></script>
  <script src="assets/js/issue-report-modal.js"></script>
  <script src="assets/js/issue-list.js"></script>
  <script src="assets/js/pilot-navigation.js"></script>
  <script src="assets/js/pilot-dashboard-widgets.js"></script>
  <script src="assets/js/member-admin-service.js"></script>
  <script src="assets/js/pilot-bootstrap.js"></script>
"""

    target_insertion = '<script src="assets/js/router.js?v=20260911-d1"></script>'
    if target_insertion not in content:
        raise ValueError("Could not find insertion target in index.html")

    content = content.replace(target_insertion, target_insertion + "\n" + pilot_scripts)

    with open(pilot_path, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(content)

    print(f"✅ Generated separate pilot entrypoint: {pilot_path}")
    print(f"File size: {os.path.getsize(pilot_path)} bytes")

if __name__ == "__main__":
    build_pilot_entrypoint()
