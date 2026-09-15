# ==============================================================================
# SAMSUNG BRANCH OPERATIONS - PRE-DEPLOYMENT STATIC GATEWAY (PRE_DEPLOY_STATIC_GATE)
# ==============================================================================
# Enforces static code quality, baseline freeze, Excel reconciliation, CI gates,
# manifest integrity, secret scanning, and package build.
#
# Exit status on success: READY_FOR_PREVIEW_DEPLOYMENT
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "SAMSUNG BRANCH OPERATIONS - PRE_DEPLOY_STATIC_GATE" -ForegroundColor Cyan
Write-Host "================================================================`n" -ForegroundColor Cyan

# 0. Pre-commit Hook Verification & Staged File Audit
Write-Host ">>> [0/8] Verifying Pre-commit Hook & Staged File Hygiene..." -ForegroundColor Yellow

$hookPath = ".git/hooks/pre-commit"
if (Test-Path $hookPath) {
    Write-Host "Pre-commit hook found at $hookPath" -ForegroundColor Green
} else {
    Write-Host "WARNING: Pre-commit hook not installed at $hookPath" -ForegroundColor DarkYellow
    Write-Host "Install: Copy .agents/skills/samsung-branch-operations-engineer/scripts/pre-commit to .git/hooks/pre-commit" -ForegroundColor DarkYellow
}

# Check currently staged files for forbidden patterns
$stagedFiles = git diff --cached --name-only 2>$null
if ($stagedFiles) {
    $forbiddenPatterns = @(
        '\.env($|\.(?!example$))',
        '^test-results/',
        '^playwright-report/',
        '^node_modules/',
        '^scratch/',
        '\.xlsx$',
        '\.(zip|zip\.txt)$',
        '__pycache__/',
        '\.pyc$',
        '^\.pilot-deploy/',
        '^\.vercel/',
        '\.(key|pem)$'
    )
    $blocked = @()
    foreach ($pattern in $forbiddenPatterns) {
        $matches = $stagedFiles | Select-String -Pattern $pattern
        if ($matches) {
            $blocked += $matches
        }
    }
    if ($blocked.Count -gt 0) {
        Write-Host "FORBIDDEN FILES DETECTED IN STAGING:" -ForegroundColor Red
        foreach ($f in $blocked) {
            Write-Host "  - $f" -ForegroundColor Red
        }
        throw "Pre-commit hygiene check failed! Remove forbidden files from staging."
    }
    Write-Host "Staged file audit PASSED: No forbidden patterns detected." -ForegroundColor Green
} else {
    Write-Host "No files currently staged. Staged file audit skipped." -ForegroundColor Gray
}

# 1. Baseline Freeze Check & Project Invariant Validation
Write-Host "`n>>> [1/8] Validating Skill Invariants, Baseline Freeze & Fixtures..." -ForegroundColor Yellow
python .agents/skills/samsung-branch-operations-engineer/scripts/verify_project_rules.py
if ($LASTEXITCODE -ne 0) { throw "Project Invariant / Baseline Freeze Validation Failed!" }

# 2. Excel Master Reconciliation against Hash-bound Acceptance Fixture
Write-Host "`n>>> [2/8] Reconciling Excel Master against Acceptance Fixture..." -ForegroundColor Yellow
python .agents/skills/samsung-branch-operations-engineer/scripts/verify_stock_reconciliation.py
if ($LASTEXITCODE -ne 0) { throw "Stock Reconciliation Failed!" }

# 3. Product Spec Identity & Field-Level Verification
Write-Host "`n>>> [3/8] Verifying Product Spec Identity & Field-Level Policies..." -ForegroundColor Yellow
python .agents/skills/samsung-branch-operations-engineer/scripts/verify_spec_identity.py
if ($LASTEXITCODE -ne 0) { throw "Product Spec Identity Verification Failed!" }

# 4. Comprehensive CI Quality Gates (12/12)
Write-Host "`n>>> [4/8] Running Comprehensive CI Quality Gates (12/12)..." -ForegroundColor Yellow
python scripts/ci_quality_gate.py
if ($LASTEXITCODE -ne 0) { throw "CI Quality Gates Failed!" }

# 5. Rebuild Dedicated Pilot Package
Write-Host "`n>>> [5/8] Rebuilding Dedicated Pilot Package..." -ForegroundColor Yellow
python scripts/build_pilot_package.py
if ($LASTEXITCODE -ne 0) { throw "Pilot Package Build Failed!" }

# 6. Verify ZIP Artifacts & Manifest SHA-256
Write-Host "`n>>> [6/9] Verifying ZIP Artifacts & Manifest SHA-256..." -ForegroundColor Yellow
python scripts/verify_pilot_zip.py
if ($LASTEXITCODE -ne 0) { throw "Pilot Zip Verification Failed!" }

python scripts/verify_runtime_zip.py
if ($LASTEXITCODE -ne 0) { throw "Runtime Zip Verification Failed!" }

# 7. Pilot ZIP Hygiene (no test/dev assets in runtime package)
Write-Host "`n>>> [7/9] Verifying Pilot ZIP Hygiene (no test assets in runtime)..." -ForegroundColor Yellow
python .agents/skills/samsung-branch-operations-engineer/scripts/verify_pilot_zip_hygiene.py
if ($LASTEXITCODE -ne 0) { throw "Pilot ZIP Hygiene Verification Failed! Test assets detected in runtime package." }

# 8. Pre-commit Hook Installation Reminder
Write-Host "`n>>> [8/9] Final Pre-commit Hook Status..." -ForegroundColor Yellow
if (-not (Test-Path $hookPath)) {
    Write-Host "REMINDER: Install pre-commit hook before next deployment cycle." -ForegroundColor DarkYellow
    Write-Host "Run: powershell -File .agents/skills/samsung-branch-operations-engineer/scripts/install_hooks.ps1" -ForegroundColor DarkYellow
} else {
    Write-Host "Pre-commit hook is installed and active." -ForegroundColor Green
}

# 9. Static Gate Completion
Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "🎉 PRE_DEPLOY_STATIC_GATE PASSED (100% SATISFIED)" -ForegroundColor Green
Write-Host "Status: READY_FOR_PREVIEW_DEPLOYMENT" -ForegroundColor Green
Write-Host "Next Step: Deploy pilot package to Vercel Preview, then run post_deploy_gate.ps1" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
