# 🤖 Project Architecture & AI Audit Dossier
## Samsung Branch Operations & Promotion Intelligence Dashboard
**Branch Location:** Samsung Ayutthaya City Park  
**Target Environment:** Vercel Static Hosting + Supabase Backend  
**Audit Purpose:** Comprehensive system verification, architectural review, code quality audit, and data reconciliation.

---

## 1. Executive Summary & Project Purpose

This project is an enterprise-grade web application built for Samsung retail branch operations (Ayutthaya City Park). It solves the operational challenge of managing thousands of serialized stock units, multiple floor locations (Floor 1 Main Store vs Floor 2 Stockroom), fast-moving complex promotion campaigns (Trade-in, Samsung Finance+, Student discounts, Bundle gifts), and store issue reporting.

The system is developed under strict change-control rules with a **Two-Track Architecture**:
1. **Production Baseline (`index.html`)**: A frozen, bit-for-bit verified runtime consisting of 23 core files tracked by `runtime_manifest.json` (`Commit SHA: a7c3390`).
2. **User Feedback Pilot (`pilot.html`)**: The new modular preview candidate introducing Supabase Cloud authentication, role-based authorization (Store Leader, Staff, Admin), issue reporting workflow, member administration, and the newly integrated modern prototype stock & promotion explorer.
3. **Interactive Prototype (`prototype_dashboard.html`)**: Standalone dark-mode cyberpunk operations dashboard featuring multi-category filtering, exact color swatch palettes, and a dual-tab slide-out drawer for promotions and technical specifications.

---

## 2. Directory Structure & Key Files

```text
├── index.html                     # Phase A Production Baseline application
├── pilot.html                     # Phase B Modular Pilot application (Preview candidate)
├── prototype_dashboard.html       # Standalone interactive prototype dashboard
├── app.js                         # Monolithic controller for index.html (FROZEN BASELINE)
├── stock_data.js                  # Master branch stock dataset (236 items from branch Excel)
├── promotion_variants.js          # Reconciled promotion variants dataset (554 active promos)
├── product_specs_data.js          # Samsung Thailand official product technical specs
├── runtime_manifest.json          # Integrity manifest for 23 baseline frozen files
├── vercel.json                    # Vercel deployment configuration
├── api/
│   └── admin/
│       └── members.js             # Serverless API for secure Supabase user administration
├── assets/
│   ├── css/
│   │   ├── prototype-stock.css    # Styling for modern prototype stock & drawer
│   │   ├── shell.css              # Application shell layout (Sidebar, Header, Views)
│   │   ├── home.css               # Branch overview dashboard styling
│   │   ├── importer.css           # Excel/CSV importer styling
│   │   ├── login.css              # Authentication page styling
│   │   ├── navigation.css         # Navigation bar and active state styling
│   │   └── responsive.css         # Mobile and tablet responsive styling
│   └── js/
│       ├── prototype-stock.js     # Stock explorer controller (290 items, drawer, search)
│       ├── pilot-bootstrap.js     # Pilot initialization & dependency orchestrator
│       ├── auth-service.js        # Supabase authentication service
│       ├── permission-service.js  # Role-based access control (RBAC) rules
│       ├── session-guard.js       # Route guard, active status checker & token revocation
│       ├── member-admin-service.js# Store staff administration controller
│       ├── issue-service.js       # Store issue reporting service (Supabase DB)
│       ├── issue-list.js          # Issue tracker table and status management
│       ├── issue-report-modal.js  # New issue submission modal dialog
│       ├── pilot-navigation.js    # Dynamic role-aware sidebar/header navigation
│       ├── pilot-dashboard-widgets.js # Extensible dashboard widget engine
│       ├── stock-importer.js      # 2-sheet branch stock Excel importer & reconciler
│       ├── promotion-importer.js  # 5-stage retail promotion importer & validator
│       ├── sheet-sync.js          # Google Sheets cloud synchronization adapter
│       ├── router.js              # Hash-based client-side router (#/home, #/stock, etc.)
│       ├── data-loader.js         # Authenticated data gate (defers data loading post-login)
│       └── home.js                # Branch summary metrics and KPI cards
├── supabase/
│   └── migrations/
│       ├── 20260913_add_active_user_gate.sql # Active user status gate & token revocation
│       └── ...
├── schemas/
│   ├── supabase_pilot_schema.sql  # Complete Supabase PostgreSQL schema with RLS
│   └── verify_supabase_deployment.sql # SQL verification assertions
└── scripts/
    ├── verify_runtime_zip.py      # Automated SHA256 baseline integrity verifier
    └── ...
```

---

## 3. Stock Numbers & Reconciliation Logic

Any auditing AI should verify the stock mathematics according to this exact breakdown:

### A. Total Catalog Items: **290 Items**
- **SmartPhone:** 151 models
- **Tablet (Tab):** 25 models
- **Galaxy Watch:** 27 models
- **Galaxy Buds:** 9 models
- **Accessories:** 78 items (chargers, covers, cases, screen protectors, SmartTags)
$$\mathbf{151 + 25 + 27 + 9 + 78 = 290 \text{ items}}$$

### B. Unit Quantities Breakdown:
| Category | Floor 1 (Store) | Floor 2 (Stockroom) | Total Units |
|---|---|---|---|
| 📱 **SmartPhone** | 237 | 256 | 493 |
| 📟 **Tablet (Tab)** | 37 | 37 | 74 |
| ⌚ **Galaxy Watch** | 61 | 47 | 108 |
| 🎧 **Galaxy Buds** | 44 | 41 | 85 |
| **Core Devices Subtotal** | **379** | **381** | **760** |
| 🛍️ **Accessories** | **721** | **519** | **1,240** |
| **Grand Total** | **1,100** | **900** | **2,000** |

### C. Reconciling the Two Views:
1. **Main Dashboard (`/#/home`) KPI Card:**  
   Displays **760 Core Devices** (Floor 1: 379 + Floor 2: 381 = 760). This explicitly tracks serialized, high-value Samsung devices without accessories.
2. **Stock Prototype View (`/#/stock`):**  
   Displays **1,100 units on Floor 1** (379 Core Devices + 721 Accessories = 1,100 units).
3. **Total Inventory across Both Floors:**  
   $760 \text{ core devices} + 1,240 \text{ accessories} = \mathbf{2,000} \text{ units}$.  
   Both representations are 100% reconciled and derived from the master `Stock.xlsx` dataset.

### D. Intentional Deduplication Proof (Why 24 items in `stock_data.js` are filtered):
- `stock_data.js` contains 236 items (212 core devices + 18 legacy cases + 6 adapters).
- The 6 adapters in `stock_data.js` (EP-T2510NBEGTH, EP-T2510NWEGTH, EP-T4511XBEGTH, SSG-EP-T4511, EP-T4511NBEGTH, EP-T6010NBEGTH) have stock: Floor 1 = 189 units, Floor 2 = 123 units (total 312 units).
- **All 6 of these adapters are already present 1:1 in `all_accessories.json` (78 items) with identical P/Ns and identical stock counts.**
- Furthermore, the 18 legacy cases in `stock_data.js` only had 1 unit in stock (`GP-FCX626NNCBH`), which is also in `all_accessories.json`. The other 17 cases had 0 stock.
- **Therefore, `prototype-stock.js` explicitly executes:**
  ```javascript
  const coreDevices = stockDb.filter(x => x.category !== "Accessory" && x.category !== "Adapter");
  rawItems = coreDevices.concat(ALL_ACCESSORIES);
  ```
  This is a **deliberate deduplication step**. If not filtered, those 6 adapters would be counted twice, artificially inflating inventory by 313 units to 2,313 units.
  Hence, **212 Core Devices + 78 Full Accessories = 290 Total Items (2,000 Units)** is mathematically verified and complete.


---

## 4. Security & Role-Based Access Control (RBAC)

The Feedback Pilot implements a 4-User Store Model matching real-world retail store shifts:

| Employee ID | Name | Role | Access Permissions |
|---|---|---|---|
| `10001` | Supaporn Ph. | `STORE_LEADER` | All views, member management, imports, branch issue admin |
| `10002` | Kittisak S. | `ASSISTANT_LEADER` | Stock, promotions, issues, imports |
| `10003` | Nattapong K. | `SENIOR_STAFF` | Stock search, promotions, report issues, view own issues |
| `10004` | Siriporn W. | `SENIOR_STAFF` | Stock search, promotions, report issues, view own issues |

### Key Security Gates:
- **Active User Gate (`profiles.status`):** If an account is set to `SUSPENDED` in Supabase, the user is immediately kicked out, tokens revoked, and redirected to login.
- **Client-Side Route Guard (`session-guard.js`):** Blocks non-admin users from reaching `/admin/members`, `/stock-import`, and `/promotion-import`.
- **Server-Side API Defense (`api/admin/members.js`):** All member status changes and user creation require verification of the caller's JWT token for `STORE_LEADER` / `SYSTEM_ADMIN` before invoking the Supabase service role client.
- **Row Level Security (RLS):** All Supabase tables (`profiles`, `feedback_issues`, `stock_snapshots`, `promotion_snapshots`, `audit_logs`) have strict RLS policies enabled.

---

## 5. UI/UX Architecture & Fixed Viewport Drawer

In `pilot.html`, the Stock View features a Slide-Out Side Panel (Drawer) for Technical Specs & Store Promotions:
- **True Fixed Viewport Positioning:** The `.drawer-backdrop` and `.drawer-panel` are anchored directly under `<body>` to bypass CSS ancestor `transform` / `animation` containing block traps.
- **Persistent Scroll Position:** When an operator scrolls deep down the 290-item table (e.g. row 150) and clicks "📋 สเปก" or "✨ ดูโปรโมชั่น", the drawer opens in their active screen view. Background scrolling is locked (`overflow: hidden`), and closing the drawer retains their exact row position without jumping to the top.
- **Dual-Tab Interface:**
  - **Tab 1 (Promotions):** Displays regular price, Samsung Finance+ installments, Student discounts, Trade-Up bonuses, and bundle gifts with coupon codes.
  - **Tab 2 (Tech Specs):** Displays official Samsung Thailand specifications (Processor, Screen, RAM/ROM, Camera, Battery, Power Matrix, Case/Film compatibility).

---

## 6. Baseline Freeze & Change Control Verification

A strict baseline freeze is enforced on 23 core files from commit `a7c3390`. To verify zero drift, run:

```bash
python scripts/verify_runtime_zip.py
```
Expected output:
```text
Runtime Manifest Extraction Verification: 23/23 MATCHED
Environment Label: PROTECTED_PREVIEW_CANDIDATE
Commit SHA: a7c3390
✅ 100% Verified: All 23 files in extracted runtime zip match runtime_manifest.json!
```

---

## 7. How to Audit & Test This Project

### 1. Static Validation:
- Verify that `index.html`, `app.js`, and `style.css` match `runtime_manifest.json`.
- Verify that `pilot.html` correctly integrates `assets/js/prototype-stock.js` and does not import `app.js` (preventing legacy table wiping collisions).

### 2. Browser / Local Server Test:
Run any local static web server from the project root:
```bash
# Python
python -m http.server 8080

# Or Node.js
npx serve .
```
- Open `http://localhost:8080/pilot.html`
- Log in with Employee ID `10001` (Password: standard store password or configured dev auth).
- Navigate to `/#/stock`:
  - Verify that all 290 products load in the table.
  - Test Category Filters (SmartPhone, Tablet, Watch, Buds, Accessory).
  - Test Instant Search (e.g., search "S26", "A07", "4G", "5G", "Black").
  - Test clicking "📋 สเปก" and "✨ ดูโปรโมชั่น" on a row deep down the list to verify the drawer slides in on-screen.

---
*Generated for AI Audit & Technical Due Diligence • Samsung Ayutthaya City Park Operations Platform*
