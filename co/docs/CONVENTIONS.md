# Engineering Conventions & Architectural Guidelines

This document outlines the core conventions and non-negotiable architectural rules for the QR Attendance Management System.

---

## 1. Architectural Principles

### 1.1 Server-Authoritative Logic
- The client only ever reports intent or observed artifacts (e.g., "I scanned token `xyz` from device `uuid`").
- The server independently and authoritatively verifies:
  - Is the authenticated user a student enrolled in this class/subject?
  - Is the student's active device registered and matching?
  - Is the QR session currently active and unexpired?
  - Has attendance already been recorded for this student in this session?
- **Zero Trust in Client-Supplied Data**: Client cannot submit attendance statuses, timestamps, student IDs (beyond the authenticated session cookie), or success indicators.

### 1.2 Database Writes & Layering
- **All database writes and Mongoose operations MUST occur inside service functions located in `src/lib/*`.**
- API routes (`src/app/api/**/route.ts`) and Server Actions validate input via Zod, authenticate the session, and call internal service functions.
- React components NEVER query or mutate Mongoose models directly.

---

## 2. API Response Envelope

All API routes must return responses conforming to the standard JSON envelope:

```typescript
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

### Success Response Example (HTTP 200/201)
```json
{
  "success": true,
  "data": {
    "sessionId": "64f1a2b3c4d5e6f7a8b9c0d1",
    "status": "present",
    "serverTimestamp": "2026-08-14T01:00:00.000Z"
  }
}
```

### Error Response Example (HTTP 400/401/403/404/409/500)
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_ATTENDANCE",
    "message": "Attendance has already been recorded for this session"
  }
}
```

---

## 3. File & Directory Naming Conventions

- **React Components**: PascalCase (e.g., `QrDisplay.tsx`, `PageContainer.tsx`, `StatBadge.tsx`).
- **Pages & Layouts**: App Router standard `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`.
- **API Routes**: `route.ts` inside relevant nested folders.
- **Service Modules & Utilities**: camelCase or kebab-case (e.g., `src/lib/attendance/calculations.ts`, `src/lib/device/registration.ts`).
- **Mongoose Models**: PascalCase matching the entity (e.g., `src/models/AttendanceRecord.ts`, `src/models/User.ts`).
- **Custom Hooks**: camelCase prefixed with `use` (e.g., `useLiveSession.ts`).
- **Test Files**: `*.test.ts` or `*.spec.ts` for unit/integration tests; `*.spec.ts` for Playwright E2E tests.

---

## 4. Error Handling Pattern

1. **Validation Errors (Zod)**: Return HTTP 400 with `INVALID_INPUT` code and field errors.
2. **Authentication / Authorization Errors**: Return HTTP 401 (`UNAUTHORIZED`) or HTTP 403 (`FORBIDDEN`).
3. **Domain & Conflict Errors**: Return appropriate status codes (e.g. HTTP 409 for `DUPLICATE_ATTENDANCE` or `ALREADY_ENROLLED`).
4. **Unhandled Server Errors**: Log full trace server-side; return HTTP 500 with generic `INTERNAL_ERROR` message to avoid leaking internals.

---

## 5. Security & Privacy Rules

- **No Student PII in QR Codes**: QR payload must only contain an opaque session token URL (`${BASE_URL}/attendance/scan?t=${token}`).
- **Device Identifiers**: Client-generated UUID stored in localStorage is a fraud-friction factor, never a biometric or hard hardware lock. Devices can be reset/re-registered with credentials.
- **CSRF & Cookie Protection**: Session cookies must be `httpOnly`, `SameSite=Lax` (or `Strict`), and `Secure` in production. State-changing requests must verify `Origin`/`Referer` headers.
- **Rate Limiting**: Critical endpoints (`/api/auth/*`, `/api/attendance/mark`, `/api/devices/*`) must be rate-limited per IP and per authenticated user.
