# Security Policy & Threat Model

This document outlines the security architecture, threat model, and specific mitigations implemented in the Anti-Cheat QR Attendance System.

---

## 1. Threat Model & Mitigations

Our system follows a zero-trust model where all assertions are validated strictly by the server.

### Threat 1: QR Code Spoofing (Remote attendance marking)
*   **Attack Vector**: A student attends remotely by having a classmate take a picture of the QR code and send it to them via chat, or by streaming/copying static URLs.
*   **Mitigation**:
    *   **Rotating Dynamic Tokens**: QR codes do not contain static URLs. Instead, they embed short-lived cryptographically secure tokens (32-byte base64url).
    *   **In-Process Token Expiration**: The teacher's dashboard rotates the session token every 5–10 seconds.
    *   **Strict Time Windows**: Attendance session documents store an expiration timestamp (default 60s). Scans are rejected if submitted after the session status changes to `expired` or `stopped`, or if the token has been rotated out.

### Threat 2: Proxy Marking (Marking attendance for absent peers)
*   **Attack Vector**: A present student signs in using multiple classmates' user accounts from the same physical phone or laptop to mark them present.
*   **Mitigation**:
    *   **1-to-1 Student-Device Registration**: During their first authenticated session, students must register their browser/device client. The server generates a unique UUID v4 and binds it to the student profile.
    *   **Hardware / Fingerprint Trust**: Only one active device is permitted per student account. Registering a new device automatically revokes the old one and logs a high-priority security audit message.
    *   **Device Match Verification**: When marking attendance via `POST /api/attendance/mark`, the client must submit the stored device UUID. The server queries the database and rejects the mark if the submitted UUID does not match the active registered device for the student.
    *   **Controlled Reset Flow**: Resetting a registered device requires the student to re-enter their password, preventing unauthorized device hijacking.

### Threat 3: API Abuse / Brute-Forcing / Denial of Service
*   **Attack Vector**: Scripts spamming endpoints to brute-force tokens or register fake devices.
*   **Mitigation**:
    *   **Email Brute-Force Rate Limiting**: The NextAuth credentials authentication provider limits login attempts to a maximum of 5 per 60 seconds per email.
    *   **Registration Rate Limiting**: Limits registration calls to 10 requests per 60 seconds per IP address.
    *   **Device Management Rate Limiting**: Limits device registration and reset calls to 5 requests per 60 seconds per IP/student.
    *   **Scan Submission Rate Limiting**: Attendance markings are rate-limited to 5 requests per 10 seconds per IP, and 3 requests per 10 seconds per student.

### Threat 4: Horizontal Privilege Escalation
*   **Attack Vector**: A student or teacher manipulates class IDs, session IDs, or student IDs in API parameters to access or edit another user's records.
*   **Mitigation**:
    *   **Explicit Ownership Validations**: The database is the single source of truth. Every API route checks the session user role (`student` vs `teacher`) and performs explicit model lookup checks (e.g. verifying `classDoc.teacherId === teacher._id` or checking if `Enrollment.findOne` exists for the student before returning class details or marking attendance).
    *   **Strict Zod Input Validation**: Input parameters and body payloads are parsed with Zod schemas configured with `.strict()` to reject extra properties, preventing Mongoose mass-assignment vulnerabilities.

---

## 2. Platform Protections

### Cross-Site Request Forgery (CSRF)
All state-changing HTTP requests (`POST`, `PATCH`, `DELETE`) are run through an origin verification filter (`verifyOrigin`). The filter compares the `Origin` and `Referer` headers against the request `Host` header. If there is a mismatch or missing headers on state-changing requests, the request is rejected with `403 Forbidden`.

### Secure HTTP Headers
The application enforces strict global security headers through Next.js header configuration:
*   **Content-Security-Policy (CSP)**: resticts resources to self-domain, allowing safe evaluations, styles, and media streaming required by HTML5 QR camera streams.
*   **X-Frame-Options**: Set to `DENY` to prevent clickjacking.
*   **X-Content-Type-Options**: Set to `nosniff` to prevent MIME-sniffing.
*   **Referrer-Policy**: Set to `strict-origin-when-cross-origin`.
*   **Permissions-Policy**: Restricts camera access strictly to the matching self-origin (`camera=(self)`).

### MongoDB Operator Injection Protection
MongoDB operator injections (such as passing `{ "$gt": "" }` to bypass string checks) are blocked by:
*   Hexadecimal ObjectId regex validation (`/^[0-9a-fA-F]{24}$/`) on path parameters.
*   Strong type checking and Zod string schemas that parse request payloads before they are passed into queries.
*   Never using `raw` query interpolations.
