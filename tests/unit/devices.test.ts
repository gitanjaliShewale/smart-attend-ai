/**
 * Phase 7 — Device / Browser Registration Tests
 *
 * Tests:
 *  - GET  /api/devices/me: retrieves active status (student only)
 *  - POST /api/devices/register: registers active device; revokes previous active device (and audits)
 *  - POST /api/devices/reset: revokes active device with password validation
 *  - Role Guard validation: restricts non-student access
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { User, Student, Teacher, Device } from "@/models";
import { registerDeviceSchema, resetDeviceSchema } from "@/lib/validation/device.schema";
import type { Session } from "next-auth";

// ============================================================
// Module-level mocks
// ============================================================
vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock("@/lib/mongodb/connection", () => ({ connectToDatabase: vi.fn().mockResolvedValue(undefined) }));

import { auth } from "@/lib/auth/auth";
import { GET as getDeviceMe } from "@/app/api/devices/me/route";
import { POST as registerDeviceRoute } from "@/app/api/devices/register/route";
import { POST as resetDeviceRoute } from "@/app/api/devices/reset/route";

const authMock = vi.mocked(auth) as unknown as { mockResolvedValueOnce: (v: Session | null) => void };

// ============================================================
// Database & Test Setup
// ============================================================
let mongod: MongoMemoryReplSet;
let studentUserId: string;
let studentMongoId: string;
let teacherUserId: string;

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
  await Promise.all([User.init(), Student.init(), Teacher.init(), Device.init()]);

  const hash = await bcrypt.hash("Password123!", 10);

  // Student Account
  const u1 = await User.create({ email: "s1@test.edu", passwordHash: hash, role: "student", isActive: true });
  const s1 = await Student.create({ userId: u1._id, studentCode: "STU-7777", fullName: "John Dev" });
  studentUserId = u1._id.toString();
  studentMongoId = s1._id.toString();

  // Teacher Account
  const u2 = await User.create({ email: "t1@test.edu", passwordHash: hash, role: "teacher", isActive: true });
  teacherUserId = u2._id.toString();
}, 30_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(() => {
  vi.clearAllMocks();
  (auth as any).mockReset();
});

// ============================================================
// Helper functions
// ============================================================
function mockSession(id: string, email: string, role: "student" | "teacher"): Session {
  return {
    user: { id, email, role, fullName: "John Dev", name: "John Dev", image: null, emailVerified: null },
    expires: "2099-01-01",
  } as unknown as Session;
}

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  const parsedUrl = new URL(url);
  const headers = new Headers({
    "content-type": "application/json",
    origin: parsedUrl.origin,
    host: parsedUrl.host,
  });
  return new NextRequest(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  } as ConstructorParameters<typeof NextRequest>[1]);
}

// ============================================================
// Test Suite
// ============================================================
describe("Device / Browser Registration (Phase 7)", () => {
  describe("GET /api/devices/me", () => {
    it("returns 401 for unauthenticated request", async () => {
      authMock.mockResolvedValueOnce(null);
      const req = makeRequest("GET", "http://localhost:3000/api/devices/me");
      const res = await getDeviceMe(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-student accounts", async () => {
      authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
      const req = makeRequest("GET", "http://localhost:3000/api/devices/me");
      const res = await getDeviceMe(req);
      expect(res.status).toBe(403);
    });

    it("returns registered: false if no active device exists", async () => {
      authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
      const req = makeRequest("GET", "http://localhost:3000/api/devices/me");
      const res = await getDeviceMe(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.registered).toBe(false);
    });
  });

  describe("POST /api/devices/register", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";

    it("allows student to register a valid UUID and sets it active", async () => {
      authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
      const req = makeRequest("POST", "http://localhost:3000/api/devices/register", { deviceUuid: validUuid });
      const res = await registerDeviceRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.deviceUuid).toBe(validUuid);
      expect(data.data.status).toBe("active");

      // Verify in DB
      const dbDevice = await Device.findOne({ studentId: studentMongoId, status: "active" });
      expect(dbDevice).toBeDefined();
      expect(dbDevice?.deviceUuid).toBe(validUuid);
    });

    it("registering a second device revokes the first one", async () => {
      const secondUuid = "987f6543-e21b-32d1-b654-426614174111";

      // Register the second device
      authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
      const req = makeRequest("POST", "http://localhost:3000/api/devices/register", { deviceUuid: secondUuid });
      const res = await registerDeviceRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.deviceUuid).toBe(secondUuid);

      // Verify the old one is revoked
      const firstDevice = await Device.findOne({ deviceUuid: validUuid });
      expect(firstDevice?.status).toBe("revoked");

      // Verify the new one is active
      const secondDevice = await Device.findOne({ deviceUuid: secondUuid });
      expect(secondDevice?.status).toBe("active");
    });

    it("rejects invalid UUID format", async () => {
      authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
      const req = makeRequest("POST", "http://localhost:3000/api/devices/register", { deviceUuid: "not-a-uuid" });
      const res = await registerDeviceRoute(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_INPUT");
    });
  });

  describe("POST /api/devices/reset", () => {
    it("fails reset with incorrect password", async () => {
      authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
      const req = makeRequest("POST", "http://localhost:3000/api/devices/reset", { password: "WrongPassword" });
      const res = await resetDeviceRoute(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it("successfully resets and revokes active device with correct password", async () => {
      authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
      const req = makeRequest("POST", "http://localhost:3000/api/devices/reset", { password: "Password123!" });
      const res = await resetDeviceRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify active device has been revoked
      const active = await Device.findOne({ studentId: studentMongoId, status: "active" });
      expect(active).toBeNull();
    });
  });

  describe("Zod Validation Schema tests", () => {
    it("registerDeviceSchema accepts valid UUIDs", () => {
      expect(registerDeviceSchema.safeParse({ deviceUuid: "123e4567-e89b-12d3-a456-426614174000" }).success).toBe(true);
    });

    it("registerDeviceSchema rejects invalid formats", () => {
      expect(registerDeviceSchema.safeParse({ deviceUuid: "abcd" }).success).toBe(false);
    });

    it("resetDeviceSchema requires non-empty password", () => {
      expect(resetDeviceSchema.safeParse({ password: "" }).success).toBe(false);
      expect(resetDeviceSchema.safeParse({ password: "123" }).success).toBe(true);
    });
  });
});
