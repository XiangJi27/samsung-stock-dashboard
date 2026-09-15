---
name: samsung-branch-operations-engineer
description: >-
  Essential engineering and verification skill for Samsung Branch Operations (Ayutthaya City Park).
  Enforces permanent project invariants: F1-only summary cards, F1+F2 product table, category hierarchy
  resolution (Cat1 -> Cat2 -> Cat3 -> Brand), exact product spec identity with field-level verification,
  fail-closed policies, baseline freeze (a7c3390), pilot layer isolation, and live browser acceptance tests.
---

# Samsung Branch Operations Engineer

This skill defines the non-negotiable architectural invariants, data calculation rules, specification identity policies, and release workflows for the **Samsung Branch Operations Stock & Promotion Dashboard** (Ayutthaya City Park Store).

Whenever you inspect, modify, debug, test, or deploy this project, you MUST strictly adhere to the guidelines and workflows in this skill.

---

## 1. Non-Negotiable Project Invariants

### A. Permanent Stock Rules
- **Summary Cards & KPIs (Every Card)**: Must strictly reflect **Floor 1 (F1) only**. Never sum F2 into summary cards or KPI totals.
- **Product Table (Only Place with F2)**:
  - `ร้านเรา (ชั้น 1)` = **F1**
  - `สาขา (ชั้น 2)` = **F2**
  - `รวมสต็อก` = **F1 + F2**
- **Summary Card Filtering**:
  - `SIM` card (58 items) = **Permanently Hidden** from summary cards.
  - `Other` card (15 items) = **Permanently Hidden** from summary cards.
  - `Premium` card (282 items) = **Displayed**.
- **Reference Document**: [stock_rules.md](./references/stock_rules.md)

### B. Category Hierarchy Resolution
- **Source of Truth Priority**:
  $$\text{Cat1} \longrightarrow \text{Cat2} \longrightarrow \text{Cat3} \longrightarrow \text{Brand}$$
  Must be evaluated **before** P/N or Description.
- **P/N Role**: P/N is used solely for validation, never for guessing or overriding category classifications.
- **Core Resolution Rules**:
  - `Audio` > `Headphone` > `True Wireless` + `Samsung` $\longrightarrow$ **Galaxy Buds**
  - `Smart Phones` $\longrightarrow$ **Smartphone**
  - `Computer and Tablet` $\longrightarrow$ **Tablet**
  - `Smart Watch` $\longrightarrow$ **Galaxy Watch**
  - `Other` > `Premium...` $\longrightarrow$ **Premium**
  - `Service, Insurance and Warranty` $\longrightarrow$ **SIM**

### C. Product Specification Identity & Field-Level Verification
- **Exact Product Identity**:
  - Brand must match (`stockBrand === specBrand`).
  - Product Type must match (`stockType === specType`).
  - Manufacturer Model must match.
- **Fail-Closed Policy**:
  - No certified match = `SPEC_NOT_VERIFIED` (returns `null` in resolver; displays yellow caution banner).
  - **NEVER** use a default fallback product.
  - **NEVER** fallback to Galaxy A07 for speakers, accessories, or unknown items.
- **Field-Level Verification (`fieldVerification`)**:
  - Verification is determined **per-field**, not as a single binary record flag.
  - **Grounded specs** (e.g. 5W, IP67, 20h playtime, TWS, strap) $\longrightarrow$ Status `VERIFIED`.
  - **Unverified specs** (e.g. Bluetooth version without official manual, Thailand warranty without dealer paperwork) $\longrightarrow$ Status `NOT_VERIFIED` / Display: `ยังไม่ได้ยืนยัน` / `ตรวจสอบตามใบรับประกันหรือผู้จัดจำหน่าย`.
- **Allowed Spec Statuses**:
  `VERIFIED` | `PARTIALLY_VERIFIED` | `SPEC_NOT_VERIFIED` | `BLOCKED_CONFLICT`
- **Reference Document**: [spec_verification_rules.md](./references/spec_verification_rules.md)

### D. Promotion State Management
- **Active Published Scope**: Exactly **142** promotions (18 exact P/N, 124 model scope).
- **September Draft Scope**: Exactly **56** promotions (32 review, 24 blocked, 0 auto-publish).
- **Draft Auto-Publish**: **0** (strictly prohibited).
- **Legacy Obsolete Numbers**:
  - `904` $\longrightarrow$ False Positive (Blocked).
  - `589` $\longrightarrow$ Superseded (Blocked).
  - Never restore legacy counts as current state.

### E. Baseline Freeze & Pilot Layer Isolation
- **Baseline Application Commit**: `a7c3390` (Locked Manifest `4dd91b1` / 23 SHA-256 verified files).
- **FROZEN FILES (DO NOT TOUCH)**:
  - `index.html` (Baseline production bundle)
  - `app.js`
  - `style.css`
  - `runtime_manifest.json`
- **PERMITTED PILOT WORKSPACE**:
  - `pilot.html`
  - `assets/js/pilot-*.js`, `assets/js/prototype-stock.js`
  - `assets/css/prototype-*.css`, `assets/css/importer.css`
  - `product_specs_data.js`
  - `api/`
  - `reports/`
  - `scripts/`
  - `supabase/`

### F. Deployment & Packaging Rules
- **Deploy Source**: Deploy **only** from the verified `samsung_stock_dashboard_feedback_pilot.zip` package extracted into a deployment directory.
- **Prohibitions**:
  - Never deploy the root project directory directly.
  - Never use `--prod` (all changes go to preview environments).
  - Never expose database service roles or admin credentials to client JS.
- **Reference Document**: [release_governance.md](./references/release_governance.md)

---

## 2. Mandatory 13-Step Pre-Flight & Execution Workflow

Before modifying code or concluding any task, you MUST follow this sequence:

```text
1. READ PROJECT RULES        -> Verify against references/project_rules.json
2. INSPECT AFFECTED FILES    -> Ensure no baseline files are targeted
3. VERIFY BASELINE FREEZE    -> Confirm index.html, app.js, style.css are untouched
4. CREATE REGRESSION TESTS   -> Write or update automated assertions before code edits
5. EDIT PILOT LAYER ONLY     -> Restrict modifications to pilot.html / pilot JS / scripts
6. SYNTAX CHECK              -> node --check <js_file> and python syntax compilation
7. RUN UNIT TESTS            -> Execute relevant unit/API tests
8. RUN CI QUALITY GATES      -> Execute python scripts/ci_quality_gate.py (Must be 12/12 PASS)
9. REBUILD PILOT PACKAGE     -> Run python scripts/build_pilot_package.py
10. VERIFY ZIP ARTIFACTS     -> Run python scripts/verify_pilot_zip.py (Runtime Drift: FALSE)
11. DEPLOY PREVIEW           -> Deploy pilot package to Vercel preview (NO --prod)
12. LIVE BROWSER ACCEPTANCE  -> Execute Playwright verification against live preview URL
13. AUDIT GIT & SECRETS      -> Check git status, git diff, and verify 0 secret leaks
```

> [!CAUTION]
> Never declare a task "100% complete" based solely on CI passing, build scripts succeeding, or hash comparisons. You must obtain passing Playwright browser execution evidence against the live DOM.

---

## 3. Reference Files & Test Fixtures

- **Machine-Readable Rules**: [project_rules.json](./references/project_rules.json)
- **Stock Invariant Fixture**: [stock_acceptance.json](./fixtures/stock_acceptance.json)
- **Category Hierarchy Fixture**: [category_regressions.json](./fixtures/category_regressions.json)
- **Spec Identity Guard Fixture**: [spec_identity_regressions.json](./fixtures/spec_identity_regressions.json)
- **Automated Rules Validator**: [verify_project_rules.py](./scripts/verify_project_rules.py)
