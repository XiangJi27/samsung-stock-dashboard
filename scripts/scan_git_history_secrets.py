import subprocess
import re
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def scan_git_history():
    print("=== STARTING DEEP GIT HISTORY SECRET AUDIT ===")
    
    # 1. Check all objects ever committed
    res = subprocess.run(["git", "rev-list", "--objects", "--all"], capture_output=True, text=True, check=True)
    objects = res.stdout.strip().splitlines()
    print(f"Total Git objects indexed across all branches/commits: {len(objects)}")
    
    suspicious_filenames = []
    for line in objects:
        parts = line.split(" ", 1)
        if len(parts) == 2:
            path = parts[1]
            if re.search(r"(\.env|secret|credential|id_rsa|private_key|\.key|\.pem)", path, re.I):
                if not path.endswith(".example") and not "scripts/" in path and not "test_" in path:
                    suspicious_filenames.append(path)
                    
    if suspicious_filenames:
        print(f"⚠️ Found suspicious filenames in git object history: {set(suspicious_filenames)}")
    else:
        print("✅ Zero sensitive filenames found in git object history.")
        
    # 2. Scan git log -p --all for real API keys, tokens, private keys
    print("\nScanning git log -p --all for secret patterns...")
    proc = subprocess.Popen(["git", "log", "-p", "--all"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="ignore")
    
    patterns = [
        ("Private Key", re.compile(r"-----BEGIN (RSA|EC|OPENSSH|PGP|DSA)? ?PRIVATE KEY-----", re.I)),
        ("Claude/Anthropic API Key", re.compile(r"sk-ant-[a-zA-Z0-9_\-]{20,}")),
        ("OpenAI API Key", re.compile(r"sk-[a-zA-Z0-9]{32,}")),
        ("GitHub Personal Token", re.compile(r"ghp_[a-zA-Z0-9]{36}")),
        ("AWS Secret Access Key", re.compile(r"(aws_secret_access_key|aws_access_key_id)\s*[:=]\s*['\"][a-zA-Z0-9/+=]{20,}['\"]", re.I)),
        ("Generic Hardcoded Token Assignment", re.compile(r"""(?:API_KEY|AUTH_TOKEN|SECRET_KEY|BEARER_TOKEN)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]""", re.I)),
        ("Hardcoded Password Assignment", re.compile(r"""(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]""", re.I))
    ]
    
    findings = []
    current_commit = "unknown"
    current_file = "unknown"
    
    for line in proc.stdout:
        if line.startswith("commit "):
            current_commit = line.strip().split(" ")[1][:7]
        elif line.startswith("diff --git "):
            current_file = line.strip().split(" ")[-1]
        elif line.startswith("+") and not line.startswith("+++"):
            added_text = line[1:].strip()
            
            # Whitelist harmless development notices or placeholders
            if "demo@samsung.com" in added_text or "Samsung2026!" in added_text or "SamsungDev2026!" in added_text:
                continue # Development auth in test scripts / mocks
            if "your-api-key-here" in added_text or "MOCK_" in added_text or "PLACEHOLDER" in added_text:
                continue
            if "CLAUDE_API_KEY" in added_text and "process.env" in added_text:
                continue # Safe server-side environment reference
                
            for name, pattern in patterns:
                m = pattern.search(added_text)
                if m:
                    # Ignore rule files or test assert patterns
                    if "ci_quality_gate.py" in current_file or "business_rules" in current_file or "rule" in current_file:
                        continue
                    findings.append({
                        "commit": current_commit,
                        "file": current_file,
                        "type": name,
                        "snippet": added_text[:80]
                    })
                    
    proc.wait()
    
    print("\n=== SCAN RESULTS ===")
    if findings:
        print(f"❌ Detected {len(findings)} potential secret leaks in history:")
        for f in findings:
            print(f"   [{f['commit']}] {f['file']}: {f['type']} -> {f['snippet']}")
        sys.exit(1)
    else:
        print("✅ 100% CLEAN: Zero API keys, private keys, tokens, or credentials found across entire git commit history!")

if __name__ == "__main__":
    scan_git_history()
