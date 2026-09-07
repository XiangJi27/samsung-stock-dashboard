# NotebookLM Read-Only Knowledge Assistant Contract

> **Contract Type**: Architectural Boundary & Data Governance Specification  
> **Status**: `ENFORCED`  
> **Target Tool**: Google NotebookLM / Generative Knowledge Assistants  
> **Date**: `2026-09-07`

---

## 1. Role & Operating Scope

Google NotebookLM is deployed strictly as a **Read-Only Knowledge Assistant and Document Reasoning Sidecar** for store staff, branch supervisors, and operations teams.

It is **NOT** a data transformation (ETL) pipeline, does **NOT** compute official prices, and has **ZERO** direct connection to production databases or dashboard state.

```text
+-----------------------------------------------------------------------------+
|                               DATA PIPELINE                                 |
|                                                                             |
|  Excel Files ---> Python Parser ---> Rule Engine ---> CI Gate ---> Database |
|                                                                        |    |
|                                                                   API Layer |
|                                                                        |    |
|                                                                    Dashboard|
+------------------------------------------------------------------------|----+
                                                                         |
                                                   Read-Only Export      |
                                                   (Zero Credentials)    v
                                                                   +----------+
                                                                   |NotebookLM|
                                                                   +----------+
                                                                         |
                                                                         v
                                                                  [Explanations]
                                                                  [Staff Q&A]
                                                                  [Conflict Alerts]
```

---

## 2. Explicitly Prohibited Operations (NEVER PERMITTED)

NotebookLM has **no write permissions** in the architecture. Under no circumstances may NotebookLM:
1. **Write or modify prices** in `validated_promotions.json`, `stock_full_data.json`, or any database.
2. **Publish promotions** directly to the web dashboard.
3. **Alter coupon codes** (e.g. changing `Studentcrd` or concatenating `01/06`).
4. **Change sale modes** (e.g. converting `TRADE_UP` or `SF_PLUS` into standard retail).
5. **Unblock quarantined variants** that were blocked by the Rule Engine.
6. **Calculate replacement prices** to resolve `#ERROR!`, `#REF!`, or `NaN` formula values.
7. **Bypass the Rule Engine or CI Quality Gate** to push unverified pricing to users.
8. **Directly feed output to client dashboard rendering modules**.

---

## 3. Permissible Use Cases (AUTHORIZED)

NotebookLM may be utilized exclusively for:
1. **Staff Q&A & Search**: Answering branch staff inquiries such as *"What are the free gifts for Galaxy S26 FE?"* or *"Explain why Galaxy Fold8 Pass F is currently blocked."*
2. **Complex Rule Explanation**: Summarizing multi-page condition documents into clear Thai bullet points for store consultants.
3. **Cross-Source Contradiction Detection**: Identifying discrepancies between retail promotion circulars and tablet accessory bulletins.
4. **Internal Onboarding & Training**: Generating internal branch training FAQs based on confirmed rules.

---

## 4. Conflict Resolution & Output Classification Policy

When NotebookLM detects a discrepancy between two sources or questions a Rule Engine decision:
- It **CANNOT** alter the active status or price of any item.
- Its output status must strictly be labeled as one of:
  - `SUGGESTION` (Recommended clarification)
  - `NEEDS_REVIEW` (Flagged for human branch supervisor review)
  - `SOURCE_CONFLICT` (Documented conflict between source files)

Human branch managers must formally confirm any rule changes in `branch_confirmed_rules.md` before the Python Rule Engine is updated.

---

## 5. Export Data Ingestion White-list & Black-list

### Permitted Data Sources (White-list)
- `validated_promotions.json` (Only records verified by CI Quality Gate)
- `audit_summary.json` (High-level compliance statistics)
- `branch_confirmed_rules.md` (Confirmed store policies)
- `reports/exact_pn_quality_gate.json` (Audit trail)
- Official manufacturer promotion PDFs / Circulars

### Strictly Prohibited Data (Black-list)
- Employee credentials, passwords, or passcodes
- Session tokens, JWTs, or API authorization headers
- Customer personal identifiable information (PII)
- Raw unredacted system logs or stack traces
- Internal corporate network hostnames, IP addresses, or secrets
