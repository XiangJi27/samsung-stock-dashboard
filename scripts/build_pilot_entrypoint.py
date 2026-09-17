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

    # index.html was intentionally mirrored from pilot.html in commit 53e3e86
    # ("fix(deployment): mirror pilot to index.html and configure vercel redirects")
    # The original a7c3390 baseline (130,505 bytes) has been superseded by the
    # current pilot-mirrored version (66,160 bytes). Hash below reflects post-53e3e86 state.
    expected_index_shas = [
        "852f26085382ec7d14cf2612414ed2b4b4a8d0f34e24a3b06836ac053bdaf004",
        "1b94d5ae7440fc2b7b5d3adc6c451e326c0dfa1c9886c87b451f16e7c6673e7a"
    ]
    actual_index_sha = hashlib.sha256(raw_bytes).hexdigest()
    if actual_index_sha not in expected_index_shas:
        raise ValueError(f"CRITICAL: index.html sha256 mismatch! Expected one of {expected_index_shas}, got {actual_index_sha}")

    print("✅ Baseline index.html verified (post-53e3e86 pilot-mirrored version).")

    # Decode text for templating
    content = raw_bytes.decode("utf-8")

    # Injections
    pilot_title = "<title>SAMSUNG Stock & Promotion Dashboard [FEEDBACK PILOT] - Ayutthaya City Park</title>"
    content = content.replace("<title>SAMSUNG Stock & Promotion Dashboard - Copperwired Branch</title>", pilot_title)

    # Central Database Banner Injection for Stock Import View
    target_pos = content.find("MANUAL_EXCEL_SNAPSHOT")
    if target_pos != -1:
        start_div = content.rfind('<div class="local-store-banner">', 0, target_pos)
        end_div = content.find('</div>', target_pos) + 6
        if start_div != -1 and end_div > start_div:
            central_banner = """<!-- Dynamic Storage Banner -->
            <div id="stockImportStorageBanner" class="local-store-banner central-db-banner" style="border-color: rgba(56, 189, 248, 0.25); background: rgba(15, 23, 42, 0.75);">
              <div class="local-store-banner-left">
                <span class="local-store-icon" id="stockStorageBannerIcon">⏳</span>
                <div>
                  <strong class="local-store-tag" id="stockStorageBannerTag" style="color: #38bdf8;">กำลังตรวจสอบสถานะฐานข้อมูล...</strong>
                  <span class="local-store-desc" id="stockStorageBannerDesc">ระบบกำลังตรวจสอบการเชื่อมต่อกับ Supabase PostgreSQL</span>
                </div>
              </div>
              <span class="local-store-badge" id="stockStorageBannerBadge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);">Status: CONNECTING</span>
            </div>"""
            if "\r\n" in content:
                central_banner = central_banner.replace("\n", "\r\n")
            content = content[:start_div] + central_banner + content[end_div:]

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
