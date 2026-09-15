# Member Administration and Route Isolation Governance

## 1. Route Isolation & DOM Lifecycle

The Member Management module serves branch operations staff administration at route `/#/admin/members`:

1. **Strict View Isolation**:
   - The Member Admin container (`#view-admin-members` or equivalent container) must have isolated DOM lifecycle management.
   - When navigating to `/#/admin/members`, all other containers (e.g. `#view-stock`, `#view-dashboard`, `#view-promotions`) must be completely hidden (`display: none` or unmounted).
   - **Never** allow Member Admin to render underneath or bleed through other operational screens.
   - When navigating away from `/#/admin/members` back to `/#/stock`, the admin view must be cleanly unmounted/hidden.

2. **Z-Index and Layering Integrity**:
   - Route containers must have deterministic z-index layering.
   - Under no circumstances should buttons, forms, or tables from the admin view remain clickable or intercept pointer events when viewing the stock dashboard.

---

## 2. Role-Based Access Control (RBAC)

Access to `/#/admin/members` is governed by strict branch roles:

| Role | Access to `/#/admin/members` | Capabilities |
|---|---|---|
| **Store Manager / Leader** | **GRANTED** | View staff list, edit roles, reset passwords, suspend/activate |
| **System Admin** | **GRANTED** | Full administrative rights |
| **Sales Staff / Member** | **DENIED** | Blocked with 403 / Access Denied screen or redirect to `/#/stock` |
| **Unauthenticated / Guest** | **DENIED** | Redirected to Login modal or entrypoint |

---

## 3. Credential Hygiene and Security Invariants

1. **Zero Hardcoded Credentials**:
   - No employee passwords, recovery phrases, or session access tokens may be committed to version control.
   - Test suites MUST read credentials exclusively from environment variables:
     - `TEST_ADMIN_EMPLOYEE_ID`
     - `TEST_ADMIN_PASSWORD`
     - `TEST_MEMBER_EMPLOYEE_ID`
     - `TEST_MEMBER_PASSWORD`
   - If credentials are not present in the environment during live testing, the runner MUST fail closed:
     ```typescript
     const employeeId = process.env.TEST_ADMIN_EMPLOYEE_ID;
     const password = process.env.TEST_ADMIN_PASSWORD;
     if (!employeeId || !password) {
       throw new Error("Missing test credentials in environment");
     }
     ```

2. **Console & Logging Sanitization**:
   - Never print passwords, bearer tokens, or sensitive user fields in `console.log`, test outputs, or gate reports.
   - Network payload logs must redact credentials with `[REDACTED]`.

3. **Credential Rotation Rule**:
   - Any credential that has ever been exposed or logged in earlier conversational turns must be rotated before deploying the application to real branch personnel.
