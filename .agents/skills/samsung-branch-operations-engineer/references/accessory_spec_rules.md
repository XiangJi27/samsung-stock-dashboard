# Product Accessory Master & Specification Invariants

This governance standard enforces strict decoupling between ERP stock inventory data and verified technical product specifications.

---

## 1. Core Principles

1. **Decoupled Architecture**:
   - ERP Stock data is the source of truth for physical inventory counts ($F1$, $F2$, Total) and accounting categories (Cat1, Cat2, Cat3).
   - Official Manufacturer Portals / Approved Masters are the source of truth for technical specifications.
   - Exact identity keys (`Exact P/N`, `GTIN/Barcode`) bridge ERP items to verified technical specification profiles.

2. **Zero Guessing & Fail-Closed Policy**:
   - If an accessory cannot be positively identified by Exact P/N, GTIN, or verified manufacturer model: **FAIL CLOSED (`SPEC_NOT_VERIFIED`)**.
   - Under no circumstances may an accessory inherit, borrow, or fall back to smartphone specifications (such as Galaxy A07 4G, Helio G85, or Knox Vault).
   - Under no circumstances may an accessory match across different brands or conflicting product types.

3. **Product Type Specialized Templates**:
   Every accessory category renders according to its dedicated template schema:
   - `BLUETOOTH_SPEAKER` (Soundcore, etc.)
   - `WALL_CHARGER` (Samsung 25W, 45W, 60W, UGREEN)
   - `PHONE_CASE` (Clear Magnet, Standing, Silicone, Flip/Fold cases)
   - `SCREEN_PROTECTOR` (Focus, Hi-Shield, Samsung Official Film)
   - `WATCH_BAND` (Peakform, Trail, Sport, Leather)
   - `DATA_CABLE` (Samsung C-to-C, ADAM elements 100W)
   - `POWER_BANK` (Wireless, Wired, PD/PPS)
   - `PREMIUM_GIFT` (Focus Premium Bag, promotion bundled gifts)

4. **Field-Level Verification Evidence**:
   - `VERIFIED`: Backed by active manufacturer official documentation or lab certificates.
   - `VERIFIED_FROM_ERP`: Backed directly by structured ERP stock attributes (e.g. wattage or connector in verified description).
   - `PARTIALLY_VERIFIED`: Product model confirmed, but certain advanced technical claims remain unproven.
   - `NOT_VERIFIED`: Placeholders with clear user advisory.
   - `BLOCKED_CONFLICT`: Rejected due to brand or product type mismatch.

---

## 2. Three-Section Spec Drawer UI Standard

When an accessory drawer is opened, it renders three distinct operational sections:

```
+-------------------------------------------------------------+
| SECTION 1: ข้อมูลสินค้าจากระบบสต๊อก (ERP Stock Master)        |
| - รหัสสินค้า (ERP P/N)    - แบรนด์สินค้า                     |
| - หมวดหมู่สต๊อก (Cat1-3)  - ราคามาตรฐาน (SRP)                |
| - สีตัวเครื่อง            - สต็อก (ชั้น 1 / ชั้น 2 / รวม)     |
+-------------------------------------------------------------+
| SECTION 2: คุณสมบัติสินค้า (ตาม Product Type Template)       |
| - แสดงเฉพาะฟิลด์ตาม Template ของประเภทสินค้านั้นๆ            |
| - ค่าฟิลด์ที่ได้รับการยืนยัน หรือแสดง 'ยังไม่ได้ยืนยัน'     |
+-------------------------------------------------------------+
| SECTION 3: สถานะการตรวจสอบและหลักฐาน (Evidence & Audit)     |
| - Badge: VERIFIED / PARTIALLY_VERIFIED / SPEC_NOT_VERIFIED  |
| - แหล่งข้อมูลอ้างอิงและลิงก์ทางการ (ถ้ามี)                  |
| - สรุปฟิลด์ที่ยืนยันแล้ว vs ฟิลด์ที่รอเอกสาร                 |
+-------------------------------------------------------------+
```

---

## 3. Matching Priority Order

1. `EXACT_INVENTORY_PN`: Strict uppercase alphanumeric match against `inventoryIdentity.inventoryPn`.
2. `EXACT_GTIN`: 13-digit barcode / GTIN match against `inventoryIdentity.gtin`.
3. `APPROVED_MANUFACTURER_MODEL`: Verified manufacturer model with mandatory Brand Guard.
4. If no match is found $\longrightarrow$ `SPEC_NOT_VERIFIED` (Drawer renders Section 1 ERP data + Fail-Closed advisory banner).
