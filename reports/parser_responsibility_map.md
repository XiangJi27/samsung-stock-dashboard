# Parser Responsibility Map & Duplication Analysis

## Executive Summary
This document analyzes the architectural responsibilities and relationship between `audit_engine.py` and `promotion_import.py` in the Samsung Branch Operations Dashboard repository, pursuant to **RULE-0: REPORT PROVENANCE CHECK**.

## Component Responsibilities

| Responsibility | `audit_engine.py` | `promotion_import.py` | Source of Truth |
| :--- | :--- | :--- | :--- |
| **Workbook Reader** | Reads `Stock.xlsx`, `Aug_ 2026 Promotion Retail_Shop Samsung .xlsx`, `Pro Tablet Acc samsung 3Aug2026.xlsx` | Reads `Stock.xlsx`, `Aug_ 2026 Promotion Retail_Shop Samsung .xlsx`, `Pro Tablet Acc samsung 3Aug2026.xlsx` | `audit_engine.py` |
| **2D Header-Guided Parser** | Implemented with merged-cell resolution (`build_merged_map`, `get_cell_meta`) | Basic 1D row-level cell indexing without full merged-cell propagation | `audit_engine.py` |
| **Normalizer & Variant Builder** | Constructs 554 active/quarantined variants with strict schema | Constructs standalone variant dictionaries | `audit_engine.py` |
| **`ADD_ON_PURCHASE` Mapping** | Implemented at L953-982 (produces 13 `TAB-R*-ADDON-KEYBOARD` variants) | **NOT IMPLEMENTED** (does not generate `ADD_ON_PURCHASE` or `TAB-R` promoIds) | `audit_engine.py` |
| **Rule Engine** | Implemented at L300-380 (`create_variant` with 15 validation checks) | Simple validator (`validate_variant`) | `audit_engine.py` |
| **Runtime Artifact Emitter** | Emits `promotion_variants.json`, `stock_full_data.json`, `promotion_variants.js`, `stock_data.js`, `rule_engine_results.json` | Emits legacy standalone JSON/JS outputs | `audit_engine.py` |

## Duplication Verdict & Architectural Decision
1. **No Parallel Active Mapping for Add-on**: `promotion_import.py` does not contain logic for `ADD_ON_PURCHASE` or `TAB-R*-ADDON-KEYBOARD`.
2. **Single Source of Truth**: `audit_engine.py` is the designated, active engine that generates all downstream runtime artifacts evaluated by CI gates and the application UI.
3. **Action Required**:
   - Implement the field mapping, provenance tracking, and rule engine correction directly in `audit_engine.py`.
   - Do NOT add redundant/divergent mapping code to `promotion_import.py` to prevent logic duplication.
