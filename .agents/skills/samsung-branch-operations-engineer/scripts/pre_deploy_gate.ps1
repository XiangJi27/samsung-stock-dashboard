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

# 1. Baseline Freeze Check & Project Invariant Validation
Write-Host ">>> [1/7] Validating Skill Invariants, Baseline Freeze & Fixtures..." -ForegroundColor Yellow
python .agents/skills/samsung-branch-operations-engineer/scripts/verify_project_rules.py
if ($LASTEXITCODE -ne 0) { throw "Project Invariant / Baseline Freeze Validation Failed!" }

# 2. Excel Master Reconciliation against Hash-bound Acceptance Fixture
Write-Host "`n>>> [2/7] Reconciling Excel Master against Acceptance Fixture..." -ForegroundColor Yellow
python .agents/skills/samsung-branch-operations-engineer/scripts/verify_stock_reconciliation.py
if ($LASTEXITCODE -ne 0) { throw "Stock Reconciliation Failed!" }

# 3. Product Spec Identity & Field-Level Verification
Write-Host "`n>>> [3/7] Verifying Product Spec Identity & Field-Level Policies..." -ForegroundColor Yellow
python .agents/skills/samsung-branch-operations-engineer/scripts/verify_spec_identity.py
if ($LASTEXITCODE -ne 0) { throw "Product Spec Identity Verification Failed!" }

# 4. Comprehensive CI Quality Gates (12/12)
Write-Host "`n>>> [4/7] Running Comprehensive CI Quality Gates (12/12)..." -ForegroundColor Yellow
python scripts/ci_quality_gate.py
if ($LASTEXITCODE -ne 0) { throw "CI Quality Gates Failed!" }

# 5. Rebuild Dedicated Pilot Package
Write-Host "`n>>> [5/7] Rebuilding Dedicated Pilot Package..." -ForegroundColor Yellow
python scripts/build_pilot_package.py
if ($LASTEXITCODE -ne 0) { throw "Pilot Package Build Failed!" }

# 6. Verify ZIP Artifacts & Manifest SHA-256
Write-Host "`n>>> [6/7] Verifying ZIP Artifacts & Manifest SHA-256..." -ForegroundColor Yellow
python scripts/verify_pilot_zip.py
if ($LASTEXITCODE -ne 0) { throw "Pilot Zip Verification Failed!" }

python scripts/verify_runtime_zip.py
if ($LASTEXITCODE -ne 0) { throw "Runtime Zip Verification Failed!" }

# 7. Static Gate Completion
Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "🎉 PRE_DEPLOY_STATIC_GATE PASSED (100% SATISFIED)" -ForegroundColor Green
Write-Host "Status: READY_FOR_PREVIEW_DEPLOYMENT" -ForegroundColor Green
Write-Host "Next Step: Deploy pilot package to Vercel Preview, then run post_deploy_gate.ps1" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
