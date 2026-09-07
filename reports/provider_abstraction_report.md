# Service Abstraction Report: Vendor-Neutral Data & Auth Providers

> **Status**: `IMPLEMENTED & ACTIVE`  
> **Source File**: [data-service.js](file:///c:/Users/JarNJay/.gemini/antigravity-ide/scratch/samsung-stock-dashboard/assets/js/data-service.js)  
> **Date**: `2026-09-07`

---

## 1. Overview of the Abstraction Layer

To ensure the Samsung Branch Operations System remains completely independent of proprietary cloud platforms (specifically Microsoft Azure and Entra ID), the application shell has decoupled:
1. **Data Access** (`DataProvider`)
2. **Identity & Session Management** (`AuthProvider`)
3. **Observability & Error Logging** (`MonitoringAdapter`)

This design allows swapping the underlying backend infrastructure (e.g. from static in-memory to serverless REST or Supabase) with zero changes to UI modules (`home.js`, `modules.js`, `app.js`).

---

## 2. Global System Configuration (`SYSTEM_CONFIG`)

The configuration is locked using `Object.freeze()` to prevent client-side runtime tampering:

```javascript
const SYSTEM_CONFIG = Object.freeze({
  dataProvider: "STATIC",
  authProvider: "DEVELOPMENT",
  notebookLmMode: "READ_ONLY",
  apiEnabled: false,
  supabaseEnabled: false,
  externalMonitoringEnabled: false,
  version: "2026.09-v2",
  buildCommit: "802a786"
});
```

---

## 3. Data Provider Hierarchy

```text
DataProvider (Base Interface)
├── StaticDataProvider        [ACTIVE]       - In-memory dataset loaded via DataLoader
├── RestApiDataProvider      [NOT_CONFIGURED] - Generic HTTP REST (Bearer + X-Branch-Code)
├── SupabaseDataProvider     [NOT_CONFIGURED] - PostgREST / Supabase Client SDK
└── FutureDataProvider       [NOT_CONFIGURED] - Extensibility Placeholder
```

### Core Interface Methods
- `getStock(filters)`: Retrieves filtered stock items (search, category, inStockOnly).
- `getPromotions(filters)`: Retrieves promotional variants (by P/N, saleMode, activeOnly).
- `getStockSummary()`: Aggregates total units, Floor 1 / Floor 2 stock, and SKU counts.
- `getAuditSummary()`: Returns compliance metrics and import batch IDs.
- `getMetadata()`: Exposes runtime environment and provider metadata.
- `healthCheck()`: Non-throwing health probe returning `{ status: "UP"|"DEGRADED", timestamp }`.

---

## 4. Auth Provider Hierarchy

`AuthProvider` is completely decoupled from `DataProvider`. This ensures that changing authentication mechanisms does not impact data retrieval logic.

```text
AuthProvider (Base Interface)
├── DevelopmentAuthProvider  [ACTIVE]       - Local Session Gate via sessionStorage
├── PasswordlessAuthProvider [NOT_CONFIGURED] - Magic Links / WebAuthn / OTP
├── SupabaseAuthProvider    [NOT_CONFIGURED] - Supabase JWT Authentication
└── FutureAuthProvider      [NOT_CONFIGURED] - Extensibility Placeholder
```

### HTTP Header Security Guidelines
1. **Bearer Token**: Transmitted as standard `Authorization: Bearer <token>`. The client never assumes this token originates from Entra ID or any specific provider.
2. **Branch Context (`X-Branch-Code`)**: Can be transmitted as a routing hint, but the server-side backend **must validate branch authorization directly from the session token**, never trusting the client header blindly.
3. **Client-Side Secrets**: **Zero API keys, service role keys, or client secrets may be embedded in client-side code.**
