import os
import zipfile
import hashlib
from datetime import datetime

ZIP_FILENAME = "samsung_stock_dashboard_full_project.zip"

EXCLUDED_DIRS = {
    ".git",
    ".vercel",
    "__pycache__",
    ".pilot-deploy",
    "scratch",
    "node_modules"
}

EXCLUDED_EXTENSIONS = {
    ".zip",
    ".zip.txt"
}

def calculate_sha256(filepath):
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def package_project():
    print(f"[EXPORT] Starting project export to {ZIP_FILENAME}...")
    start_time = datetime.now()
    
    file_count = 0
    total_uncompressed_bytes = 0

    with zipfile.ZipFile(ZIP_FILENAME, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk("."):
            # Prune excluded directories in-place
            dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS and not d.startswith(".git")]
            
            for file in files:
                if any(file.endswith(ext) for ext in EXCLUDED_EXTENSIONS):
                    continue
                
                # Exclude temporary diag scripts
                if file.startswith("diag_") or file == "diag.py":
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

    compressed_size = os.path.getsize(ZIP_FILENAME)
    sha256_checksum = calculate_sha256(ZIP_FILENAME)
    duration = (datetime.now() - start_time).total_seconds()

    print("=" * 70)
    print("PROJECT EXPORT COMPLETED SUCCESSFULLY!")
    print(f"Archive:           {ZIP_FILENAME}")
    print(f"Total Files:       {file_count} files")
    print(f"Uncompressed Size: {total_uncompressed_bytes / (1024*1024):.2f} MB")
    print(f"Compressed Size:   {compressed_size / (1024*1024):.2f} MB ({compressed_size:,} bytes)")
    print(f"SHA256 Checksum:   {sha256_checksum}")
    print(f"Duration:          {duration:.2f} seconds")
    print("=" * 70)

if __name__ == "__main__":
    package_project()
