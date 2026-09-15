# Permanent Stock Architecture Rules

## 1. Summary Cards and KPI Invariants

The summary cards at the top of the `#/stock` dashboard represent the active working inventory of the store's main sales floor (Floor 1 / ชั้น 1):

1. **Floor 1 Only**:
   - Every single summary card MUST calculate:
     $$\text{Card Total} = \sum \text{Item F1}$$
   - **Never** include F2 (Floor 2 / ชั้น 2) in card counts.
   - The primary title must clearly indicate: `สต๊อกทั้งหมด ชั้น 1`.
   - The KPI units must display `(ชั้น 1)` (e.g. `ชิ้น/เครื่อง (ชั้น 1)`).

2. **Suppression of Non-Physical/Non-Store Cards**:
   - `SIM` summary card: **Permanently Hidden**. (58 SIM units exist in stock master but must not clutter hardware inventory cards).
   - `Other` summary card: **Permanently Hidden**. (15 miscellaneous items).
   - `Premium` summary card: **Displayed**. (282 promotional premium gift items).

3. **Mathematical Balance Guarantee**:
   $$\text{Hardware F1 (1,628)} + \text{SIM (58)} + \text{Other (15)} = \text{Total F1 (1,701)}$$

---

## 2. Product Table Display Rules

The product table is the **only** location where F2 inventory is shown to sales staff:

| Column Title | Data Field | Explanation |
|---|---|---|
| **ร้านเรา (ชั้น 1)** | `f1` | In-store stock immediately available for walk-in sales. |
| **สาขา (ชั้น 2)** | `f2` | Upstairs branch stock requiring warehouse retrieval. |
| **รวมสต็อก** | `total` | Arithmetic sum: `f1 + f2`. Checked by CI RULE-06. |

---

## 3. Provenance & Batch Sync
- Every stock view must display the current active batch header (`activeBatchId`).
- Historical or legacy batch IDs (e.g. `IMPORT-20260906-002`) are forbidden.
- The default active batch is `STOCK-20260914-LATEST` (derived from `stock(1).xlsx`).
