# QR Attendance Management System

A production-grade, server-authoritative web-based student attendance management system powered by rotating cryptographic QR codes, client browser device identifiers for fraud friction, and MongoDB Atlas.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router, TypeScript strict mode)
- **Styling**: Tailwind CSS + shadcn/ui + Lucide Icons
- **Database & ODM**: MongoDB Atlas + Mongoose
- **Authentication**: Auth.js (NextAuth v5) Credentials Provider, JWT session in httpOnly cookies
- **Security & Password Hashing**: bcryptjs, Zod validation schemas
- **QR Engine**: `qrcode` (server-side generation), `html5-qrcode` (client-side scanning)
- **Testing**: Vitest + React Testing Library (unit/integration), Playwright (E2E)

---

## Architectural Principles

1. **Server Authority**: The backend is the sole authority on attendance validation. The client only reports a scanned session token.
2. **Rotating QR Codes**: Sessions rotate cryptographic tokens every 5–10 seconds to eliminate static screenshot sharing.
3. **Compound Unique Guard**: Atomic duplicate-scan prevention enforced via `{ sessionId: 1, studentId: 1 }` unique compound index on `attendanceRecords`.
4. **Device Fraud Friction**: Client-generated UUID v4 tracked per student; single active device allowed with auditable re-registration.
5. **No PII in QR Codes**: QR codes contain only opaque session token URLs.

---

## Getting Started

### 1. Configure Environment Variables
Copy `.env.example` to `.env.local` and set your credentials:
```bash
cp .env.example .env.local
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Run Tests
```bash
npm run test
```

---

## Security & Production Secrets

For production environments, ensure you configure the following environment secrets in your server/hosting platform:
- `MONGODB_URI`: The connection URI to your production MongoDB cluster.
- `AUTH_SECRET`: A cryptographically secure 32-byte string used for NextAuth session encryption. You can generate one using `openssl rand -base64 32`.
- `QR_TOKEN_SECRET`: A secret key used to sign and verify temporary dynamic tokens.
- Ensure that `NEXTAUTH_URL` points to the canonical host URL (e.g. `https://yourdomain.edu`) so session callbacks resolve correctly and cookies are restricted appropriately.

