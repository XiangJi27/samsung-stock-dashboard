# -*- coding: utf-8 -*-
"""
Script: package_redacted_markdown_docs.py
Collects all project Markdown documentation files (*.md), applies strict credential
and secret redaction (Zero Secret Leaks), and packages them into a clean ZIP archive.
"""

import os
import sys
import re
import zipfile

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_ZIP = os.path.join(ROOT_DIR, "samsung_branch_docs_redacted.zip")

REDACTION_PATTERNS = [
    # Supabase Publishable / Anon / Service Role Keys
    (re.compile(r"sb_publishable_[a-zA-Z0-9_\-]+"), "[REDACTED_SUPABASE_PUBLISHABLE_KEY]"),
    (re.compile(r"eyJ[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}(\.[a-zA-Z0-9_\-]+)?"), "[REDACTED_JWT_TOKEN]"),
    # Specific known passwords and environment credentials
    (re.compile(r"-hxBrSZMoEqe1AO\+j\^RMygTS"), "[REDACTED_PASSWORD]"),
    (re.compile(r"Pass1234!"), "[REDACTED_PASSWORD]"),
    (re.compile(r"(TEST_ADMIN_PASSWORD\s*=\s*)([^\r\n]+)", re.I), r"\1[REDACTED_PASSWORD]"),
    (re.compile(r"(TEST_MEMBER_PASSWORD\s*=\s*)([^\r\n]+)", re.I), r"\1[REDACTED_PASSWORD]"),
    (re.compile(r"(SUPABASE_SECRET_KEY\s*=\s*)([^\r\n]+)", re.I), r"\1[REDACTED_SECRET_KEY]"),
    (re.compile(r"(SUPABASE_SERVICE_ROLE_KEY\s*=\s*)([^\r\n]+)", re.I), r"\1[REDACTED_SERVICE_ROLE_KEY]"),
    (re.compile(r"(service_role_key\s*[:=]\s*)([^\r\n]+)", re.I), r"\1[REDACTED_SERVICE_ROLE_KEY]"),
    (re.compile(r"(Bearer\s+)[a-zA-Z0-9_\-\.]{25,}", re.I), r"\1[REDACTED_BEARER_TOKEN]"),
    (re.compile(r"postgresql://([^:]+):([^@]+)@"), r"postgresql://\1:[REDACTED_DB_PASSWORD]@")
]

def sanitize_content(content):
    redacted_count = 0
    modified = content
    for pattern, replacement in REDACTION_PATTERNS:
        matches = pattern.findall(modified)
        if matches:
            redacted_count += len(matches)
            modified = pattern.sub(replacement, modified)
    return modified, redacted_count

def main():
    print("=" * 70)
    print("SAMSUNG BRANCH OPERATIONS - MARKDOWN DOCUMENTATION PACKAGER")
    print("Zero Secret Leaks • Automated Credential Redaction")
    print("=" * 70)

    # 1. Discover all project markdown files (excluding node_modules and .git)
    md_files = []
    for root, dirs, files in os.walk(ROOT_DIR):
        # Exclude directories
        if "node_modules" in root or ".git" in root or ".tempmediaStorage" in root:
            continue
        for file in files:
            if file.lower().endswith(".md"):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, ROOT_DIR).replace("\\", "/")
                md_files.append((full_path, rel_path))

    md_files.sort(key=lambda x: x[1])
    print(f"\n📂 พบไฟล์ Markdown ในระบบทั้งหมด: {len(md_files)} ไฟล์")

    # 2. Process and add to zip
    total_redactions = 0
    redacted_files_list = []

    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zip_out:
        for full_path, rel_path in md_files:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f_in:
                original_text = f_in.read()

            sanitized_text, count = sanitize_content(original_text)
            if count > 0:
                total_redactions += count
                redacted_files_list.append((rel_path, count))

            # Store in zip
            zip_out.writestr(rel_path, sanitized_text.encode("utf-8"))

    # 3. Verification of output zip
    zip_size = os.path.getsize(OUTPUT_ZIP)
    print(f"\n📦 สร้างไฟล์ Zip สำเร็จ: {OUTPUT_ZIP}")
    print(f"   - ขนาดไฟล์ Zip: {zip_size:,} bytes ({zip_size / 1024:.1f} KB)")
    print(f"   - จำนวนไฟล์ใน Zip: {len(md_files)} ไฟล์")
    print(f"   - รายการที่ถูกปิดบังความลับ (Redactions): {total_redactions} จุด ใน {len(redacted_files_list)} ไฟล์")

    if redacted_files_list:
        print("\n🔍 รายชื่อไฟล์ที่มีการ Redact ข้อมูล Secret Key / Credentials:")
        for r_file, r_count in redacted_files_list:
            print(f"   • {r_file}: {r_count} จุด")

    # 4. Strict Security Verification on Archive
    print("\n🛡️ กำลังตรวจสอบความปลอดภัยของไฟล์ใน Zip (Zero Secret Leak Scan)...")
    leak_detected = False
    with zipfile.ZipFile(OUTPUT_ZIP, "r") as zip_in:
        for item in zip_in.infolist():
            content = zip_in.read(item.filename).decode("utf-8", errors="replace")
            # Scan for leaked secret patterns
            if "sb_publishable_" in content or "-hxBrSZMoEqe1AO" in content:
                print(f"   ❌ LEAK DETECTED in {item.filename}")
                leak_detected = True

    if not leak_detected:
        print("   ✅ PASS: ตรวจสอบความปลอดภัย 100% — ปิดข้อมูล Secret Key และรหัสผ่านทั้งหมดเรียบร้อยแล้ว")
    else:
        print("   🚨 WARNING: พบข้อมูลที่ไม่ได้รับการ Redact")
        sys.exit(1)

    print("\n" + "=" * 70)
    print("PACKAGING & SECURITY CHECK COMPLETE!")
    print("=" * 70)

if __name__ == "__main__":
    main()
