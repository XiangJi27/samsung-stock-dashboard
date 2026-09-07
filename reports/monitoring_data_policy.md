# Monitoring & Log Redaction Data Policy

> **Policy Status**: `ACTIVE & ENFORCED`  
> **Source Module**: [data-service.js](file:///c:/Users/JarNJay/.gemini/antigravity-ide/scratch/samsung-stock-dashboard/assets/js/data-service.js)  
> **Date**: `2026-09-07`

---

## 1. Overview & Objectives

In compliance with team data privacy standards and corporate data loss prevention principles, the Samsung Branch Operations System implements **Strict Client-Side Log Redaction** before any event or error is processed.

This policy defines:
1. Permitted log telemetry (safe fields).
2. Strictly prohibited and automatically redacted sensitive fields.
3. Standardized system error codes.
4. Active monitoring adapters.

---

## 2. Permitted Telemetry (Safe Fields)

The following contextual fields may be transmitted to active monitoring adapters:
- `timestamp`: ISO-8601 formatted event timestamp.
- `applicationVersion`: Current frontend build version.
- `route`: Current active hash route (e.g. `#/stock`, `#/login`, `#/home`).
- `errorCode`: Standardized error identifier.
- `errorType`: Exception type name (e.g. `TypeError`, `SecurityError`).
- `browserFamily`: User agent browser group.
- `dataBatchId`: Active import batch identifier (e.g. `IMPORT-20260906-002`).
- `anonymousSessionId`: Ephemeral random session ID (no employee identifier).

---

## 3. Strictly Prohibited & Redacted Fields (Black-List)

The `BaseMonitoringAdapter.redact()` method automatically replaces matching keys and string patterns with `[REDACTED]`:

| Sensitive Field Category | Target Keys / Patterns | Replacement Action |
| :--- | :--- | :--- |
| **Authentication Credentials** | `password`, `passcode`, `secret`, `privateKey`, `apiKey` | Replaced with `"[REDACTED]"` |
| **Identity Data** | `employeeId` (full corporate ID) | Replaced with `"[REDACTED]"` |
| **Security Tokens** | `token`, `accessToken`, `refreshToken`, `authorization`, `Bearer ...` | Redacted |
| **Browser Session State** | `cookie`, `cookies`, `sessionStorage` dump | Redacted |
| **Customer Data** | `customerName`, `phoneNumber`, `email`, `nationalId` | Redacted |
| **Unprocessed Financials** | `rawExcelRow`, unparsed formula strings | Redacted |

---

## 4. Standardized System Error Codes

All application components must utilize the following standardized error codes:

| Error Code | Trigger Condition | Severity |
| :--- | :--- | :--- |
| `STOCK_DATA_UNAVAILABLE` | `window.STOCK_DATABASE` missing or failed to initialize | CRITICAL |
| `PROMOTION_DATA_UNAVAILABLE` | `window.PROMOTION_VARIANTS` missing or failed to initialize | CRITICAL |
| `SCHEMA_MISMATCH` | Dataset header or column mapping differs from schema definition | HIGH |
| `DATA_VERSION_MISMATCH` | Client dataset version differs from server version | HIGH |
| `RUNTIME_HASH_MISMATCH` | File hash does not match `runtime_manifest.json` | BLOCKING |
| `ROUTE_RENDER_FAILED` | Dynamic view injection threw an unhandled exception | MEDIUM |
| `API_UNAVAILABLE` | Remote serverless API returned 5xx or connection refused | HIGH |
| `AUTH_SESSION_INVALID` | Stored session token is corrupted or expired | MEDIUM |

---

## 5. Monitoring Adapters Status

```text
MonitoringAdapter (Base Interface)
├── ConsoleMonitoring   [ACTIVE]       - Outputs redacted diagnostic logs to browser console
├── SupabaseMonitoring  [NOT_CONFIGURED] - Reserved for team-controlled private log database
└── SentryMonitoring    [NOT_CONFIGURED] - Reserved for future private crash reporting
```

**Development Policy**: Only `ConsoleMonitoring` is enabled in development. External log webhooks, unauthenticated third-party services, and commercial cloud analytics endpoints are strictly deactivated.
