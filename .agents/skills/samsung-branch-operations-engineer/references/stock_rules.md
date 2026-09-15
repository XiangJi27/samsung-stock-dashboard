# Permanent Stock Architecture Rules

## 1. Summary Cards and KPI Invariants

The summary cards at the top of the `#/stock` dashboard represent the active working inventory of the store's main sales floor (Floor 1 / ชั้น 1):

1. **Floor 1 Only Invariant**:
   - Every single summary card MUST calculate:
     $$\text{Card Total} = \sum \text{Item F1}$$
   - **Never** include F2 (Floor 2 / ชั้น 2) in card counts.
   - The primary title must clearly indicate: `สต๊อกทั้งหมด ชั้น 1`.
   - The KPI units must display `(ชั้น 1)` (e.g. `ชิ้น/เครื่อง (ชั้น 1)`).

2. **Suppression of Non-Physical/Non-Store Cards**:
   - `SIM` summary card: **Permanently Hidden**.
     - **SIM Quantity = 58 ชิ้น (Units)**
     - **SIM P/N = 11 รายการ (Distinct Part Numbers)**
     - *Terminology Rule*: Never confuse quantity units ("ชิ้น") with part number catalog items ("รายการ"). Do NOT say "SIM 58 รายการ". The correct expression is **"SIM 58 ชิ้น (11 รายการ P/N)"**.
   - `Other` summary card: **Permanently Hidden**.
     - **Other Quantity = 15 ชิ้น (Units)**
     - **Other P/N = 9 รายการ (Distinct Part Numbers)**
   - `Premium` summary card: **Displayed**. (282 promotional premium gift items).

3. **Mathematical Balance Guarantee**:
   $$\text{Hardware F1 (1,628 ชิ้น)} + \text{SIM (58 ชิ้น)} + \text{Other (15 ชิ้น)} = \text{Total F1 (1,701 ชิ้น)}$$

---

## 2. Product Table Display Rules

The product table is the **only** location where F2 inventory is shown to sales staff:

| Column Title | Data Field | Explanation |
|---|---|---|
| **ร้านเรา (ชั้น 1)** | `f1` | In-store stock immediately available for walk-in sales. |
| **สาขา (ชั้น 2)** | `f2` | Upstairs branch stock requiring warehouse retrieval. |
| **รวมสต็อก** | `total` | Arithmetic sum: `f1 + f2`. Checked by CI quality gates. |

---

## 3. Dynamic Snapshot Acceptance vs Permanent Rules

Stock figures are **NOT** permanent business rules; they change whenever a new Excel file is uploaded.

- **Permanent Invariants (Never Change)**:
  - Summary cards must always be Floor 1 only (`F1_ONLY`).
  - SIM and Other cards must always remain hidden from summary cards.
  - Category hierarchy resolution (`Cat1 -> Cat2 -> Cat3 -> Brand`) never changes.
  - Total column must always equal `F1 + F2`.

- **Dynamic Acceptance Fixture (Hash-Bound)**:
  - Each master file upload calculates a new acceptance fixture:
    `fixtures/stock_snapshot_acceptance.json`
  - The fixture is strictly bound to `sourceFilename` and `sourceSha256`.
  - Recomputed via `scripts/build_stock_fixture.py <excel_file>`.

---

## 4. Provenance & Batch Sync
- Every stock view must display the current active batch header (`activeBatchId`).
- Historical or legacy batch IDs (e.g. `IMPORT-20260906-002`) are forbidden.
- The default active batch is `STOCK-20260914-LATEST` (derived from `stock(1).xlsx`).
