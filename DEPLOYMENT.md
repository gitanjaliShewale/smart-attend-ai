# Production Deployment Guide

This document explains the steps to configure, deploy, secure, and maintain the Anti-Cheat QR Attendance Management System in production.

---

## 1. MongoDB Atlas Configuration

1. **Create an Atlas Cluster**: Setup a free (M0) or production tier cluster on MongoDB Atlas.
2. **Retrieve Connection String**: Obtain the standard connection URI under **Connect** -> **Drivers** -> **Node.js**.
3. **Configure Network Access**: Whitelist Vercel's IP addresses (or allow access from anywhere `0.0.0.0/0` if Vercel serverless functions are used without fixed proxies, secure with database user credentials).

### Setup and Verify Database Indexes
Mongoose auto-creation of indexes can be slow or sometimes skipped in serverless environments. Run the index confirmation script against the target production database before directing traffic:
```bash
# Set production URI
export MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.mongodb.net/attendance_prod"

# Run sync script
node scripts/confirm-indexes.js
```
Verify the output logs list the critical anti-cheat indexes:
- `AttendanceRecord`: Unique compound index `{ sessionId: 1, studentId: 1 }`
- `NotificationCooldown`: Unique compound index `{ studentId: 1, subjectId: 1 }`
- `User`: Unique `{ email: 1 }`

---

## 2. Vercel Deployment

1. **Install Vercel CLI** (or import the repository to Vercel via GitHub Integration).
2. **Configure Environment Variables**:
   Add the following environment variables under Vercel Project Settings:
   
   | Variable Name | Description | Value Example / Generation |
   | :--- | :--- | :--- |
   | `MONGODB_URI` | Production Atlas Connection URI | `mongodb+srv://user:pass@cluster.mongodb.net/...` |
   | `AUTH_SECRET` | Secret key for Auth.js cookie encryption | Generate using `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | Canonical URL of production deployment | `https://attendqr.yourdomain.edu` |
   | `AUTH_TRUST_HOST` | Bypasses NextAuth host trust validation | `true` |
   | `QR_TOKEN_SECRET` | Cryptographic key for token rotation | Generate using `openssl rand -base64 32` |
   | `NODE_ENV` | Enforces production runtime guards | `production` |

3. **Deploy**:
   ```bash
   vercel --prod
   ```

---

## 3. Database Seeding Safety

The database seed script (`scripts/seed.ts`) is designed to set up initial demo accounts and **must never be run directly against the production database**.
- Running it will delete all collection data (`User.deleteMany({})`, etc.)!
- The script has a built-in production check:
  `if (process.env.NODE_ENV === "production") { abort(); }`
- If you need to seed test accounts in a staging environment, do so using a temporary database cluster, never production.

---

## 4. Rollback and Disaster Recovery

### Application Rollback
To revert the Vercel application to a previous stable deployment:
1. Go to the **Vercel Dashboard** -> **Deployments**.
2. Locate the last stable deployment.
3. Click the options menu (`...`) and select **Promote to Production**. This rolls back the routing instantly.

### Database Index Rollback
If an index introduces lock contention or issues:
1. Connect directly to the production cluster using MongoDB Compass or `mongosh`.
2. Locate the collection (e.g. `attendanceRecords`).
3. View indexes, find the target index (e.g. `sessionId_1_studentId_1`), and select **Drop Index**.
