# Architecture Decision Record (ADR): Enterprise IT Governance & Approval Status

> **Current Approval Status**: `NOT_CONFIRMED` / `PENDING`  
> **Decision Owner**: Copperwired Branch Project Team & Enterprise IT Coordinator  
> **Decision Date**: `PENDING` (Under Review)  
> **Target Environment**: Feature Branch `feature/phase-a-application-shell`

---

## 1. Executive Summary & Current Stance

The Samsung Branch Operations prototype has reached high client-side maturity with an authenticated application shell, Golden Case validation (17/17), and CI quality gate validation (11/11). 

However, **there is currently no official evidence or written approval** that Corporate IT / Copperwired IT has reviewed or authorized:
1. Utilization of Microsoft Entra ID (Azure AD) or custom application registrations.
2. Deployment of Azure Functions or external cloud database subscriptions.
3. Hosting branch inventory or promotional pricing on public cloud infrastructure (Vercel, Supabase, etc.).

**Mandatory Stance**:
- **Phase C (Backend & Enterprise Authentication) is placed on strict HOLD**.
- No Azure resources, Entra ID app registrations, Supabase projects, or external webhooks will be created.
- Production deployment and merging into `main` are **strictly prohibited**.

---

## 2. Current Infrastructure & Data Exposure Profile

| Dimension | Current State | Risk / Exposure Evaluation |
| :--- | :--- | :--- |
| **Hosting Platform** | Vercel Static Hosting (Public Preview / Production URLs) | High Risk if unauthenticated; Deployment Protection is currently not configured on preview. |
| **Data Storage** | Client-side JavaScript Bundles (`stock_data.js`, `promotion_variants.js`) | Medium-High Risk: Inventory numbers and pricing formulas are bundled client-side. |
| **Authentication** | Client-Side Session UI Gate (`sessionStorage`) | Development-only gate; does not prevent direct access to static asset URLs if inspected. |
| **Backend API** | None (100% Client Static) | Zero server-side attack surface, but lacks server-enforced authorization. |
| **Monitoring** | Local Browser Console Only (`ConsoleMonitoring`) | Zero data leakage to third-party endpoints; log redaction actively filters credentials. |

---

## 3. Proposed Architecture Options for Independent vs Corporate Systems

### Option 1: Independent Team-Managed Architecture (Recommended)
- **Identity**: Independent session / passwordless auth or local token validation managed by the team.
- **Backend / DB**: Lightweight serverless API or private database isolated from enterprise intranet.
- **Knowledge Assistant**: Google NotebookLM used strictly as a **Read-Only Assistant** (zero write permissions, zero publishing authority).
- **Pros**: Agile development, zero dependency on slow corporate tenant approvals.
- **Governance Requirement**: Must confirm that data stored externally conforms to corporate classification policies.

### Option 2: Full Corporate IT Integration (Azure / Entra ID)
- **Identity**: Microsoft Entra ID (SSO / MFA / Corporate Tenant).
- **Backend**: Azure Functions inside corporate Azure Subscription.
- **Database**: Azure SQL / Cosmos DB with corporate VPN / Private Link.
- **Pros**: Full corporate compliance, enterprise audit logging.
- **Cons**: High administrative friction, long lead time for security approvals and tenant provisioning.

---

## 4. Formal Questionnaire for Corporate IT & Security

To be formally communicated if corporate integration is requested:

```text
เรียน ทีม IT / Information Security

ขณะนี้กำลังพัฒนาต้นแบบระบบภายในสาขาสำหรับแสดงข้อมูล Stock และ Promotion 
โดยระบบยังไม่เชื่อมต่อ Nimbus หรือ POS และไม่มีการตัดสต็อกขายอัตโนมัติ

ปัจจุบันต้นแบบทำงานเป็น Static Web Application บน Feature Branch 
และยังไม่ได้เปิด Production เนื่องจากต้องการขอคำแนะนำและข้อกำหนดด้านสถาปัตยกรรมของบริษัท:

1. นโยบายข้อมูล:
   - ข้อมูล Stock สาขาและ Promotion จัดเป็นข้อมูลระดับใด (Public, Internal, Confidential)?
   - สามารถจัดเก็บหรือประมวลผลบน Cloud ภายนอก Tenant บริษัทได้หรือไม่?
   - อนุญาตให้นำขึ้น Vercel (Static) หรือ Supabase หรือไม่?

2. การพิสูจน์ตัวตน (Authentication):
   - อนุญาตให้ขอ App Registration บน Microsoft Entra ID สำหรับระบบนี้หรือไม่?
   - จำเป็นต้องผ่าน Corporate SSO และบังคับใช้ MFA หรือไม่?

3. ระบบหลังบ้าน (Backend & Hosting):
   - อนุญาตให้ใช้ Azure Functions หรือระบบ Serverless หรือไม่? มี Subscription/Resource Group รองรับหรือไม่?
   - มีข้อกำหนดให้ใช้ Azure Static Web Apps หรือ App Service ภายใต้โดเมนบริษัทแทน Vercel หรือไม่?
   - ต้องเชื่อมต่อผ่าน VPN / Private Link หรือไม่?

4. การตรวจสอบความปลอดภัย (Security & Audit):
   - ต้องผ่าน Vulnerability Scan / Penetration Testing ก่อนใช้งานหรือไม่?
   - ข้อกำหนดการเก็บ Audit Log และ Data Retention มีระยะเวลาเท่าใด?

ระหว่างรอคำแนะนำ ระบบจะยังไม่เชื่อมต่อข้อมูลจริงผ่าน Backend 
และจะไม่มีการ Merge เข้าสู่ Production ครับ
```

---

## 5. Explicitly Prohibited Actions (Until Official Written Approval)

1. **NO** creation of Azure Functions, Azure SQL, or Azure Application Insights.
2. **NO** registration of applications or requesting client secrets in corporate Entra ID tenants.
3. **NO** provisioning of Supabase production databases containing unredacted branch data.
4. **NO** embedding of API keys or administrative secrets in client-facing browser bundles.
5. **NO** deployment of real proprietary branch inventory or confidential promo formulas to unprotected public previews.
6. **NO** merge of `feature/phase-a-application-shell` into `main`.
7. **NO** bypass of Rule Engine or CI Quality Gate under any circumstances.
