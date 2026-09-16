# Marketplace Evidence Rules & Shopee Official/Mall Pipeline

This document establishes the official governance standard for utilizing marketplace data (specifically Shopee Mall and Official Brand Stores) as **secondary supporting evidence** for product accessory specifications in the Samsung Branch Operations Dashboard.

---

## 1. Core Principles & Safety Invariants

> [!IMPORTANT]
> **Non-Negotiable Marketplace Boundaries**:
> 1. **Zero Impact on Inventory**: Marketplace data must **NEVER** modify Floor 1 (`f1`), Floor 2 (`f2`), or Total inventory quantities under any circumstances.
> 2. **Zero Impact on Hierarchy**: Marketplace data must **NEVER** alter ERP category classification (`Cat1`, `Cat2`, `Cat3`).
> 3. **Zero Impact on Pricing**: Marketplace data must **NEVER** overwrite ERP standard retail prices (SRP).
> 4. **No Auto-Elevation to `VERIFIED`**: Information sourced solely from marketplace listings must **NEVER** be promoted to `VERIFIED`. `VERIFIED` is strictly reserved for Manufacturer Official sources.
> 5. **Follower Count $\neq$ Technical Accuracy**: Shop follower counts, sales volume, and customer reviews reflect store popularity, not technical specification accuracy. They may serve only as supporting reputation scores, never as primary evidence.
> 6. **No Ambiguous Variant Bleed**: When a single product page lists multiple variants (e.g. 1M vs. 2M, 60W vs. 100W), attributes must be explicitly tied to the exact variant matching the inventory P/N. Unassigned attributes must be flagged as `VARIANT_AMBIGUOUS` and withheld from automated publication.

---

## 2. Hierarchy of Evidence Sources

```
[Level 1] Manufacturer Official Website (Primary Authority)
   └── [Level 2] Manufacturer Support Page / Datasheet / Official PDF Manual
          └── [Level 3] Shopee Mall Official Brand Store (Secondary Supporting Source)
                 └── [Level 4] Authorized National Distributor Store (Secondary Supporting Source)
                        └── [Level 5] High-Reputation Verified Seller (Advisory / Review Queue Only)
                               └── [Level 6] General Marketplace Seller (Discovery Leads Only; Blocked from Master)
```

---

## 3. Allowed Marketplace Source Types

| Source Type | Verification Criteria | Permitted Field Status |
| :--- | :--- | :--- |
| `SHOPEE_MALL_OFFICIAL` | Shopee Mall badge + Exact Brand Owner match + Exact P/N or GTIN match. | `SUPPORTED_BY_OFFICIAL_MARKETPLACE` |
| `SHOPEE_AUTHORIZED_DISTRIBUTOR` | Shopee Mall / Authorized Distributor badge (e.g. SIS, Synnex) + Exact P/N match. | `SUPPORTED_BY_OFFICIAL_MARKETPLACE` |
| `SHOPEE_HIGH_REPUTATION_SELLER` | Non-mall seller with high rating (>4.8) and high sales, but lacking official brand endorsement. | `MARKETPLACE_SUGGESTED_REVIEW_REQUIRED` (Review Queue only) |
| `SHOPEE_UNVERIFIED_SELLER` | General third-party marketplace merchant without verifiable distribution credentials. | `REJECTED_EVIDENCE` (Blocked from Master) |

---

## 4. Field-Level Status Matrix

- **`VERIFIED`**: Confirmed by Manufacturer Official sources (Level 1 or 2).
- **`VERIFIED_FROM_ERP`**: Stated directly in internal ERP stock descriptions (e.g. color "Black", "100W" in item name).
- **`SUPPORTED_BY_OFFICIAL_MARKETPLACE`**: Verified against Level 3 or Level 4 official marketplace stores with exact identity match and score $\ge 90$.
- **`MARKETPLACE_SUGGESTED_REVIEW_REQUIRED`**: Sourced from high-reputation stores or matching with minor ambiguity (score 75–89). Held in review queue.
- **`NOT_VERIFIED`**: Attribute has no verified documentation.
- **`BLOCKED_CONFLICT`**: Contradiction between marketplace listing and ERP/Manufacturer data (e.g. Brand or Product Type mismatch).

---

## 5. Confidence Scoring Engine (0 to 100)

### 5.1 Additive Score Components
- **Shopee Mall / Official Brand Badge**: `+35 points`
- **Exact P/N or GTIN Match**: `+25 points`
- **Brand & Manufacturer Model Match**: `+15 points`
- **Product Type Alignment**: `+10 points`
- **Exact Variant Alignment** (Color, Length, Wattage, Pack Quantity): `+10 points`
- **Multi-Source Cross-Agreement**: `+5 points`

### 5.2 Deductive Penalties & Blocking Rules
- **No Exact P/N or GTIN** (matched solely on description): `-30 points`
- **Multi-Variant Page without Per-Variant Specs** (`VARIANT_AMBIGUOUS`): `-20 points`
- **Unverified Third-Party Seller**: `-20 points`
- **ERP Metadata Conflict** (SRP or Cat mismatch): `-40 points`
- **Brand Mismatch** (e.g. ERP = Soundcore, Listing = Samsung): **`BLOCKED_CONFLICT` (Score = 0)**
- **Product Type Mismatch** (e.g. ERP = Cable, Listing = Charger): **`BLOCKED_CONFLICT` (Score = 0)**
- **Direct Contradiction with Manufacturer Official Source**: **`SUPERSEDED_CONFLICT` (Score = 0)**

### 5.3 Decision Thresholds
$$\begin{aligned}
\text{Score} \ge 90 &\implies \mathbf{SUPPORTED\_BY\_OFFICIAL\_MARKETPLACE} \quad (\text{Auto-accepted as supporting evidence}) \\
75 \le \text{Score} \le 89 &\implies \mathbf{MARKETPLACE\_SUGGESTED\_REVIEW\_REQUIRED} \quad (\text{Human Review Queue}) \\
\text{Score} < 75 &\implies \mathbf{REJECTED\_EVIDENCE} \quad (\text{Discarded}) \\
\text{Conflict Detected} &\implies \mathbf{BLOCKED\_CONFLICT} \quad (\text{Immediate Fail-Closed})
\end{aligned}$$

---

## 6. Structure of a Marketplace Evidence Source

```json
{
  "sourceId": "SRC-SHOPEE-ADAM-OFFICIAL-001",
  "sourceType": "SHOPEE_MALL_OFFICIAL",
  "platform": "Shopee Thailand",
  "shopName": "ADAM elements Official Store",
  "shopVerification": {
    "mallBadge": true,
    "officialBrandMatch": true,
    "authorizedDistributor": false,
    "rating": 4.9,
    "followerCount": 100000,
    "reviewCount": 5000
  },
  "productIdentity": {
    "inventoryPn": "4710343478157",
    "gtin": "4710343478157",
    "brand": "ADAM elements",
    "productType": "DATA_CABLE"
  },
  "url": "https://shopee.co.th/example-product",
  "retrievedAt": "2026-09-16T04:30:00Z",
  "contentHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "confidenceScore": 95,
  "evidenceStatus": "SUPPORTED_BY_OFFICIAL_MARKETPLACE"
}
```

---

## 7. Structure of a Marketplace-Supported Spec Field

```json
{
  "maximumPower": {
    "value": 100,
    "unit": "W",
    "displayValue": "สูงสุด 100W",
    "status": "SUPPORTED_BY_OFFICIAL_MARKETPLACE",
    "sourceId": "SRC-SHOPEE-ADAM-OFFICIAL-001",
    "evidenceLocator": "Product Attributes > Maximum Power (100W)",
    "confidenceScore": 95
  }
}
```

---

## 8. Quality Gate Invariants (Automated Checks)
1. `Non-official seller auto-verified` = 0
2. `Follower count used as sole evidence` = 0
3. `Exact P/N mismatch auto-accepted` = 0
4. `Cross-brand marketplace evidence` = 0
5. `Variant ambiguity auto-published` = 0
6. `Shopee evidence modifying stock quantity` = 0
7. `Verified marketplace fields missing sourceId` = 0
