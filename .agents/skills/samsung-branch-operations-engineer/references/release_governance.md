# Release Governance & Deployment Architecture

## 1. Dual-Scope Isolation Model

To guarantee zero regression of audited baseline code, this repository operates under a strict two-layer isolation model:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: PRODUCTION BASELINE (FROZEN AT a7c3390)           │
│  - 23 Files locked by runtime_manifest.json (SHA-256)       │
│  - index.html (Baseline bundle), app.js, style.css          │
│  - Never touched by feature work or experiments             │
└──────────────────────────────┬──────────────────────────────┘
                               │ Isolated
┌──────────────────────────────▼──────────────────────────────┐
│  LAYER 2: FEEDBACK PILOT (ACTIVE DEVELOPMENT)               │
│  - pilot.html, assets/js/prototype-stock.js                 │
│  - assets/css/prototype-stock.css, product_specs_data.js    │
│  - api/admin/members.js, scripts/, reports/                 │
│  - Packaged into samsung_stock_dashboard_feedback_pilot.zip │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Mandatory Packaging & Verification Pipeline

Never deploy loose working files or a full workspace archive. The release pipeline requires:

1. **Rebuild Pilot Package**:
   ```bash
   python scripts/build_pilot_package.py
   ```
   - Bundles exactly 44 runtime files into `samsung_stock_dashboard_feedback_pilot.zip`.
   - Generates `pilot_runtime_manifest.json` with computed SHA-256 hashes.
   - Verifies baseline zip mtime is completely unchanged.

2. **Verify Package Manifests**:
   ```bash
   python scripts/verify_pilot_zip.py
   python scripts/verify_runtime_zip.py
   ```
   - Verifies that all extracted files match their manifests with 0 hash discrepancies.
   - Verifies `Runtime Drift After Package: FALSE`.

3. **Execute Full CI Quality Gate**:
   ```bash
   python scripts/ci_quality_gate.py
   ```
   - All 12 Gates must PASS (0 Warnings, 0 Blocked).

4. **Deploy to Preview (Non-Prod)**:
   ```bash
   # Extract pilot zip to temporary deploy folder
   npx vercel deploy <deploy_dir> --yes
   ```
   - Never pass `--prod`.
   - Keep production deployment locked.

5. **Execute Live Playwright Browser Acceptance**:
   ```bash
   python scripts/verify_live_preview.py
   ```
   - Tests authenticated login (`CPW3862`).
   - Tests route isolation, provenance bar, category card counts, table arithmetic.
   - Tests Soundcore spec drawer positive and negative assertions.
   - Saves visual screenshots as evidence.
