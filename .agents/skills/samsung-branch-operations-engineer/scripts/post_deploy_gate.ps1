# ==============================================================================
# SAMSUNG BRANCH OPERATIONS - POST-DEPLOYMENT LIVE GATEWAY (POST_DEPLOY_LIVE_GATE)
# ==============================================================================
# 3-Tier Verification Architecture:
# 1. Manifest Schema, Hashes & Live Deployment match Expected Commit (verify_live_manifest.py)
# 2. Local Pilot ZIP Hygiene (verify_pilot_zip_hygiene.py)
# 3. Product Accessory Master & Anti-Leakage Coverage (verify_accessory_spec_coverage.py)
# 4. Browser UI & Route Integrity via TypeScript + Playwright (11 tests)
# 5. Evidence Report Validation & Final Signoff
#
# Exit status on success: READY_FOR_INTERNAL_PILOT
# ==============================================================================

param(
    [string]$PreviewUrl = "",
    [string]$ExpectedCommit = ""
)

$ErrorActionPreference = "Stop"

# URL Resolution Priority: param > VERCEL_PREVIEW_URL > PREVIEW_URL > default
if (-not $PreviewUrl) {
    $PreviewUrl = $env:VERCEL_PREVIEW_URL
}
if (-not $PreviewUrl) {
    $PreviewUrl = $env:PREVIEW_URL
}
if (-not $PreviewUrl) {
    $PreviewUrl = "https://samsung-stock-pilot.vercel.app"
}

$PreviewUrl = $PreviewUrl.Trim().TrimEnd("/")

if ($PreviewUrl -notmatch "^https://[A-Za-z0-9.-]+$") {
    throw "Invalid Preview URL: $PreviewUrl (must be https://... without path or query)"
}

$env:PREVIEW_URL = $PreviewUrl
$env:VERCEL_PREVIEW_URL = $PreviewUrl

# Expected Commit Resolution Priority: param > EXPECTED_GIT_COMMIT > local manifest > git HEAD
if (-not $ExpectedCommit) {
    $ExpectedCommit = $env:EXPECTED_GIT_COMMIT
}
if (-not $ExpectedCommit) {
    $manifestPath = "pilot_runtime_manifest.json"
    if (Test-Path $manifestPath) {
        try {
            $manifestJson = Get-Content $manifestPath -Raw | ConvertFrom-Json
            $ExpectedCommit = [string]$manifestJson.packageBuiltFromCommit
        } catch {
            $ExpectedCommit = ""
        }
    }
}
if (-not $ExpectedCommit) {
    try {
        $ExpectedCommit = (git rev-parse --short HEAD 2>$null).Trim()
    } catch {
        $ExpectedCommit = ""
    }
}

if (-not $ExpectedCommit) {
    throw "EXPECTED_GIT_COMMIT could not be resolved."
}

$env:EXPECTED_GIT_COMMIT = $ExpectedCommit
$env:EXPECTED_PILOT_ENVIRONMENT = "FEEDBACK_PILOT_PREVIEW_CANDIDATE"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "SAMSUNG BRANCH OPERATIONS - POST_DEPLOY_LIVE_GATE" -ForegroundColor Cyan
Write-Host "Target Preview URL : $PreviewUrl" -ForegroundColor Cyan
Write-Host "Expected Commit    : $ExpectedCommit" -ForegroundColor Cyan
Write-Host "================================================================`n" -ForegroundColor Cyan

# 0. Credential Hygiene Verification
if (-not $env:TEST_ADMIN_PASSWORD) {
    $localEnv = ".env.feedback-pilot.local"
    if (Test-Path $localEnv) {
        Write-Host "Loading credentials from $localEnv (sanitized, zero console printing)..." -ForegroundColor Gray
    } else {
        throw "TEST_ADMIN_PASSWORD is not set in environment or $localEnv"
    }
}

# 1. Live Manifest, Full File SHA-256 Hashes, & Accessory Master Verification
Write-Host ">>> [1/5] Verifying live manifest, SHA-256 hashes, and Accessory Master..." -ForegroundColor Yellow
python .agents/skills/samsung-branch-operations-engineer/scripts/verify_live_manifest.py
if ($LASTEXITCODE -ne 0) {
    throw "LIVE_MANIFEST_GATE_FAILED: Live deployment files or manifest do not match expectations."
}

# 2. Local Pilot ZIP Hygiene
Write-Host "`n>>> [2/5] Verifying Pilot ZIP Hygiene (zero test assets in runtime)..." -ForegroundColor Yellow
python .agents/skills/samsung-branch-operations-engineer/scripts/verify_pilot_zip_hygiene.py
if ($LASTEXITCODE -ne 0) {
    throw "PILOT_ZIP_HYGIENE_FAILED: Found disallowed files inside runtime ZIP package."
}

# 3. Accessory Master & Marketplace Evidence Invariants Audit
Write-Host "`n>>> [3/5] Verifying Accessory Spec Coverage & Marketplace Evidence Invariants..." -ForegroundColor Yellow
python scripts/verify_accessory_spec_coverage.py
if ($LASTEXITCODE -ne 0) {
    throw "ACCESSORY_MASTER_GATE_FAILED: Accessory rules or coverage audit failed."
}
python scripts/verify_marketplace_evidence.py
if ($LASTEXITCODE -ne 0) {
    throw "MARKETPLACE_EVIDENCE_GATE_FAILED: Marketplace evidence rules or scoring audit failed."
}

# 4. Playwright Live Browser Test Suite (11 Tests)
Write-Host "`n>>> [4/5] Executing Playwright TypeScript Test Suite on Live URL..." -ForegroundColor Yellow
npx playwright test --config=.agents/skills/samsung-branch-operations-engineer/playwright.config.ts
if ($LASTEXITCODE -ne 0) {
    throw "PLAYWRIGHT_LIVE_GATE_FAILED: Live browser tests failed on $PreviewUrl."
}

# 5. Finalize Evidence and Validate Reports
Write-Host "`n>>> [5/5] Finalizing Evidence Reports..." -ForegroundColor Yellow
$reportPath = "reports/live_manifest_verification.json"
if (-not (Test-Path $reportPath)) {
    throw "EVIDENCE_REPORT_MISSING: $reportPath was not created."
}

$report = Get-Content $reportPath -Raw | ConvertFrom-Json
if ($report.status -ne "PASS") {
    throw "EVIDENCE_STATUS_FAILED: Live verification report status is $($report.status)."
}

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "🎉 POST_DEPLOY_LIVE_GATE PASSED (100% SATISFIED)" -ForegroundColor Green
Write-Host "Status              : READY_FOR_INTERNAL_PILOT" -ForegroundColor Green
Write-Host "Target URL          : $PreviewUrl" -ForegroundColor Green
Write-Host "Live Commit         : $($report.live_commit)" -ForegroundColor Green
Write-Host "Matched Live Files  : $($report.matched_files)" -ForegroundColor Green
Write-Host "Accessory Records   : $($report.accessory_master.record_count)" -ForegroundColor Green
Write-Host "Evidence File       : $reportPath" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
