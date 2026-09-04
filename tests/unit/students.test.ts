/**
 * Phase 4 — Student Management API Tests
 *
 * Tests:
 *  - GET  /api/students/me: returns authenticated student's own profile
 *  - PATCH /api/students/me: updates fullName only; validates input
 *  - Authorization: no client-supplied ID is accepted (identity from session only)
 *  - Role guard: teacher sessions cannot reach student endpoints
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { User, Student, Teacher } from "@/models";
import { updateStudentProfileSchema } from "@/lib/validation/student.schema";
import type { Session } from "next-auth";

// ============================================================
// Module-level mocks for next-auth's `auth()` server function
// ============================================================
vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));

vi.mock("@/lib/mongodb/connection", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
}));

import { auth } from "@/lib/auth/auth";
import { GET, PATCH } from "@/app/api/students/me/route";

// Typed mock — avoids NextMiddleware overload resolution confusion at build time
const authMock = vi.mocked(auth) as unknown as {
  mockResolvedValueOnce: (val: Session | null) => void;
};

// ============================================================
// Test DB setup
// ============================================================
let mongod: MongoMemoryReplSet;

let studentUserId: string;
let studentMongoId: string;
let otherStudentUserId: string;
let teacherUserId: string;

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  await Promise.all([User.init(), Student.init(), Teacher.init()]);

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash("Password123!", salt);

  const u1 = await User.create({ email: "alice@test.edu", passwordHash: hash, role: "student", isActive: true });
  const s1 = await Student.create({ userId: u1._id, studentCode: "STU-1000", fullName: "Alice Smith" });
  studentUserId = u1._id.toString();
  studentMongoId = s1._id.toString();

  const u2 = await User.create({ email: "bob@test.edu", passwordHash: hash, role: "student", isActive: true });
  await Student.create({ userId: u2._id, studentCode: "STU-1001", fullName: "Bob Jones" });
  otherStudentUserId = u2._id.toString();

  const u3 = await User.create({ email: "teacher@test.edu", passwordHash: hash, role: "teacher", isActive: true });
  await Teacher.create({ userId: u3._id, fullName: "Prof. Test" });
  teacherUserId = u3._id.toString();
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// Helper: build a minimal NextRequest
// ============================================================
function makeRequest(method: "GET" | "PATCH", body?: unknown): NextRequest {
  const url = "http://localhost:3000/api/students/me";
  const headers = new Headers({
    "content-type": "application/json",
    origin: "http://localhost:3000",
    host: "localhost:3000",
  });
  const init: ConstructorParameters<typeof NextRequest>[1] = {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  return new NextRequest(url, init);
}

// ============================================================
// Helper: make a typed session for vi.mocked(auth)
// ============================================================
function mockSession(overrides: {
  id: string;
  email: string;
  role: "student" | "teacher";
  fullName: string;
}): Session {
  return {
    user: { ...overrides, name: overrides.fullName, image: null, emailVerified: null },
    expires: "2099-01-01",
  } as unknown as Session;
}

// ============================================================
// GET /api/students/me
// ============================================================
describe("GET /api/students/me", () => {
  it("returns 401 when no session exists", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when session belongs to a teacher", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: teacherUserId, email: "teacher@test.edu", role: "teacher", fullName: "Prof. Test" })
    );
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error.code).toBe("FORBIDDEN");
  });

  it("returns own profile for authenticated student", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: studentUserId, email: "alice@test.edu", role: "student", fullName: "Alice Smith" })
    );
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.email).toBe("alice@test.edu");
    expect(data.data.studentCode).toBe("STU-1000");
    expect(data.data.studentId).toBe(studentMongoId);
  });

  it("SECURITY: response is always scoped to the session userId — no other student's data is accessible", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: studentUserId, email: "alice@test.edu", role: "student", fullName: "Alice Smith" })
    );
    const res = await GET();
    const data = await res.json();
    expect(data.data.studentCode).toBe("STU-1000"); // Alice's code, not Bob's STU-1001
    expect(JSON.stringify(data)).not.toContain(otherStudentUserId);
  });
});

// ============================================================
// PATCH /api/students/me
// ============================================================
describe("PATCH /api/students/me", () => {
  it("returns 401 when no session", async () => {
    authMock.mockResolvedValueOnce(null);
    const req = makeRequest("PATCH", { fullName: "Updated Name" });
    const res = await PATCH(req);
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when session belongs to a teacher", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: teacherUserId, email: "teacher@test.edu", role: "teacher", fullName: "Prof. Test" })
    );
    const req = makeRequest("PATCH", { fullName: "Updated Name" });
    const res = await PATCH(req);
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 on validation failure (empty name)", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: studentUserId, email: "alice@test.edu", role: "student", fullName: "Alice Smith" })
    );
    const req = makeRequest("PATCH", { fullName: "" });
    const res = await PATCH(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
  });

  it("returns 400 on validation failure (name too short)", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: studentUserId, email: "alice@test.edu", role: "student", fullName: "Alice Smith" })
    );
    const req = makeRequest("PATCH", { fullName: "A" });
    const res = await PATCH(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
  });

  it("SECURITY: ignores studentId, userId, studentCode, role fields injected in body", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: studentUserId, email: "alice@test.edu", role: "student", fullName: "Alice Smith" })
    );
    const req = makeRequest("PATCH", {
      fullName: "Alice Renamed",
      studentId: "00000000deadbeefcafebabe",  // ignored
      userId: otherStudentUserId,              // ignored
      studentCode: "HIJACK-CODE",             // ignored — not in schema
      role: "teacher",                        // ignored — not in schema
    });
    const res = await PATCH(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    const updatedStudent = await Student.findOne({ userId: studentUserId });
    expect(updatedStudent?.fullName).toBe("Alice Renamed");
    expect(updatedStudent?.studentCode).toBe("STU-1000"); // unchanged
  });

  it("successfully updates fullName and persists to database", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: studentUserId, email: "alice@test.edu", role: "student", fullName: "Alice Renamed" })
    );
    const req = makeRequest("PATCH", { fullName: "Alice Johnson-Smith" });
    const res = await PATCH(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.fullName).toBe("Alice Johnson-Smith");
    const inDb = await Student.findOne({ userId: studentUserId });
    expect(inDb?.fullName).toBe("Alice Johnson-Smith");
  });
});

// ============================================================
// Zod schema unit tests (no DB needed)
// ============================================================
describe("updateStudentProfileSchema validation", () => {
  it("accepts valid full name", () => {
    const r = updateStudentProfileSchema.safeParse({ fullName: "Alice Johnson" });
    expect(r.success).toBe(true);
  });

  it("rejects empty string", () => {
    const r = updateStudentProfileSchema.safeParse({ fullName: "" });
    expect(r.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const r = updateStudentProfileSchema.safeParse({ fullName: "A".repeat(101) });
    expect(r.success).toBe(false);
  });

  it("trims whitespace from fullName", () => {
    const r = updateStudentProfileSchema.safeParse({ fullName: "  Bob Trimmed  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fullName).toBe("Bob Trimmed");
  });

  it("does not pass extra forbidden fields through (Zod strips unknown keys)", () => {
    const r = updateStudentProfileSchema.safeParse({ fullName: "Valid Name", studentCode: "HACK", role: "teacher" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>).studentCode).toBeUndefined();
      expect((r.data as Record<string, unknown>).role).toBeUndefined();
    }
  });
});
