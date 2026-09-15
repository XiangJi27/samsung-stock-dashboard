# Product Specification Verification & Identity Guard Rules

## 1. Deterministic Product Identity

Product specifications must be resolved strictly deterministically to eliminate cross-brand and cross-category contamination:

1. **Deterministic Match Order**:
   - **Step 1: Exact P/N Match** (e.g. `194644055783`, `SM-S928BZTQTHL`, `EF-DX920UBEGTH`).
   - **Step 2: Brand/Model Resolver** (Brand-specific lookup e.g. Soundcore Select 4 Go, Galaxy S26 Ultra).
   - **Step 3: Ecosystem Strict Guard** (Samsung ecosystem models only match if stock brand is Samsung).
   - **Step 4: Cross-Brand & Cross-Type Validation** (`validateSpecMatch(item, candidate)`):
     - `stockBrand !== specBrand` $\longrightarrow$ **REJECT (BLOCK)**
     - `stockType !== specType` $\longrightarrow$ **REJECT (BLOCK)**
   - **Step 5: Fail-Closed Policy**:
     - No candidate or failed validation $\longrightarrow$ **Return `null`** (`SPEC_NOT_VERIFIED`).
     - **NEVER** return a default product.
     - **NEVER** return Galaxy A07 for accessories, speakers, or unknown devices.

---

## 2. Field-Level Verification Architecture (`fieldVerification`)

Record-level verification is too coarse and risks presenting AI-hallucinated or dealer-claimed attributes as verified manufacturer truths.

### Status Definitions
| Status | Meaning | UI Presentation |
|---|---|---|
| `VERIFIED` | 100% of technical specs backed by certified official manufacturer documentation. | Green `VERIFIED` badge. |
| `PARTIALLY_VERIFIED` | Core physical specs confirmed, but select market-dependent or model-dependent specs pending proof. | Amber `PARTIALLY_VERIFIED` badge + breakdown of verified vs pending fields. |
| `SPEC_NOT_VERIFIED` | No official specification matched to this item. | Yellow caution empty-state banner (`SPEC_NOT_VERIFIED`). Basic ERP data remains visible. |
| `BLOCKED_CONFLICT` | Contradiction detected between ERP metadata and spec claims. | Blocked from rendering drawer. |

### Concrete Field Evidence Standard (e.g. Soundcore Select 4 Go A31X1)
- **Verified Fields (`VERIFIED`, `MANUFACTURER_OFFICIAL`)**:
  - Output Power: `5W`
  - Waterproof Rating: `IP67`
  - Playtime: `20 Hours`
  - Wireless Stereo: `TWS`
  - Portability: `Built-in Strap`
  - Floatable Design: `Yes`
- **Pending Fields (`NOT_VERIFIED`)**:
  - Bluetooth Version: `null` (Display: `Bluetooth: รองรับ`, `เวอร์ชัน Bluetooth: ยังไม่ได้ยืนยัน`).
  - Thailand Warranty: `null` (Display: `ตรวจสอบตามใบรับประกันหรือผู้จัดจำหน่ายของสินค้ารายการนี้`).

### Unconditional Regression Gates (CI RULE-09)
1. `Soundcore → Galaxy A07 leakage = 0`
2. `Soundcore → Smartphone template = 0`
3. `Unknown product → Default specs = 0`
4. `Bluetooth 5.4 without evidence = BLOCK`
5. `Thailand 18-month warranty without evidence = BLOCK`
