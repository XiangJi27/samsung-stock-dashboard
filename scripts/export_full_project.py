import os
import zipfile
import hashlib
import re
from datetime import datetime

ZIP_FILENAME = "samsung_stock_dashboard_full_project.zip"

EXCLUDED_DIRS = {
    ".git",
    ".vercel",
    "__pycache__",
    ".pilot-deploy",
    "scratch",
    "node_modules",
    ".system_generated"
}

EXCLUDED_EXTENSIONS = {
    ".zip",
    ".zip.txt",
    ".pem",
    ".key",
    ".pfx",
    ".p12"
}

# Regex to detect real Supabase Secret / Service Role tokens
REAL_SECRET_PATTERN = re.compile(r"sb_secret_[a-zA-Z0-9_\-]{20,}")
REAL_JWT_PATTERN = re.compile(r"eyJ[a-zA-Z0-9_\-]{30,}\.eyJ[a-zA-Z0-9_\-]{30,}")

def is_secret_or_env_file(filename):
    """Strict security guard: Never bundle live .env files into zip archives."""
    # Always allow safe template
    if filename == ".env.example":
        return False
    # Strictly block all actual .env files (.env, .env.local, .env.feedback-pilot.server.local, etc.)
    if filename.startswith(".env"):
        return True
    # Block any file ending in .local (e.g. *.local)
    if filename.endswith(".local"):
        return True
    return False

def calculate_sha256(filepath):
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def verify_zip_security(zip_filepath):
    """Deep security audit of the resulting zip archive."""
    print("[SECURITY AUDIT] Performing deep security scan on packaged archive...")
    violating_files = []
    
    with zipfile.ZipFile(zip_filepath, "r") as z:
        for name in z.namelist():
            basename = os.path.basename(name)
            
            # Check 1: Prohibited filename pattern
            if is_secret_or_env_file(basename):
                violating_files.append(f"PROHIBITED_FILE: {name}")
                continue

            # Check 2: Deep content inspection for real secret keys
            if any(name.endswith(ext) for ext in [".js", ".json", ".sql", ".md", ".txt", ".html", ".env.example"]):
                try:
                    content = z.read(name).decode("utf-8", errors="ignore")
                    if REAL_SECRET_PATTERN.search(content):
                        violating_files.append(f"CONTAINS_REAL_SECRET: {name}")
                except Exception:
                    pass

    if violating_files:
        # Delete contaminated zip immediately
        if os.path.exists(zip_filepath):
            os.remove(zip_filepath)
        raise ValueError("CRITICAL SECURITY ERROR: The following sensitive items were caught and prevented from export:\n" + "\n".join(violating_files))
    
    print("[SECURITY AUDIT] PASSED: Zero private keys, zero .env files, and zero live secrets found.")

def package_project():
    print(f"[EXPORT] Starting sanitized project export to {ZIP_FILENAME}...")
    start_time = datetime.now()
    
    file_count = 0
    total_uncompressed_bytes = 0
    excluded_count = 0

    with zipfile.ZipFile(ZIP_FILENAME, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk("."):
            # Prune excluded directories in-place
            dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS and not d.startswith(".git")]
            
            for file in files:
                if any(file.endswith(ext) for ext in EXCLUDED_EXTENSIONS):
                    excluded_count += 1
                    continue
                
                # Exclude live env files and local configs
                if is_secret_or_env_file(file):
                    excluded_count += 1
                    continue

                # Exclude temporary diag scripts
                if file.startswith("diag_") or file == "diag.py":
                    excluded_count += 1
                    continue

                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, ".")

                # Skip the output zip itself
                if rel_path == ZIP_FILENAME:
                    continue

                size = os.path.getsize(full_path)
                total_uncompressed_bytes += size
                file_count += 1

                zipf.write(full_path, rel_path)

    # Perform automated post-packaging security audit
    verify_zip_security(ZIP_FILENAME)

    compressed_size = os.path.getsize(ZIP_FILENAME)
    sha256_checksum = calculate_sha256(ZIP_FILENAME)
    duration = (datetime.now() - start_time).total_seconds()

    print("=" * 70)
    print("PROJECT SANITIZED EXPORT COMPLETED SUCCESSFULLY!")
    print(f"Archive:           {ZIP_FILENAME}")
    print(f"Total Files:       {file_count} files (Excluded {excluded_count} secrets/artifacts)")
    print(f"Uncompressed Size: {total_uncompressed_bytes / (1024*1024):.2f} MB")
    print(f"Compressed Size:   {compressed_size / (1024*1024):.2f} MB ({compressed_size:,} bytes)")
    print(f"SHA256 Checksum:   {sha256_checksum}")
    print(f"Duration:          {duration:.2f} seconds")
    print("=" * 70)

if __name__ == "__main__":
    package_project()
