# ==============================================================================
# SAMSUNG BRANCH OPERATIONS - GIT HOOKS INSTALLER
# ==============================================================================
# Installs project Git hooks from the Skill directory into .git/hooks/
# Run this on any new machine or after cloning the repository.
#
# Usage: powershell -File .agents/skills/samsung-branch-operations-engineer/scripts/install_hooks.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"

$SkillScriptsDir = ".agents/skills/samsung-branch-operations-engineer/scripts"
$GitHooksDir = ".git/hooks"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "SAMSUNG BRANCH OPERATIONS - GIT HOOKS INSTALLER" -ForegroundColor Cyan
Write-Host "================================================================`n" -ForegroundColor Cyan

# Verify we're in the project root
if (-not (Test-Path ".git")) {
    throw "Not in a Git repository root. Run this script from the project root directory."
}

# Ensure hooks directory exists
if (-not (Test-Path $GitHooksDir)) {
    New-Item -ItemType Directory -Path $GitHooksDir -Force | Out-Null
}

# Install pre-commit hook
$sourceHook = "$SkillScriptsDir/pre-commit"
$targetHook = "$GitHooksDir/pre-commit"

if (-not (Test-Path $sourceHook)) {
    throw "Source hook not found: $sourceHook"
}

Copy-Item $sourceHook $targetHook -Force
Write-Host "Installed: pre-commit hook" -ForegroundColor Green

# Verify installation
$installedHooks = @()
if (Test-Path "$GitHooksDir/pre-commit") { $installedHooks += "pre-commit" }

Write-Host "`n----------------------------------------------------------------" -ForegroundColor Gray
Write-Host "Installed hooks:" -ForegroundColor Gray
foreach ($hook in $installedHooks) {
    $hookFile = Get-Item "$GitHooksDir/$hook"
    Write-Host "  $hook ($($hookFile.Length) bytes)" -ForegroundColor Green
}

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "Git hooks installation complete." -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
