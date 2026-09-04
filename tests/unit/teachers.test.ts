/**
 * Phase 5 — Teacher Management API Tests
 *
 * Tests:
 *  - GET  /api/teachers/me: returns authenticated teacher's own profile
 *  - PATCH /api/teachers/me: updates fullName only; validates input
 *  - Authorization: no client-supplied ID is accepted (identity from session only)
 *  - Role guard: student sessions cannot reach teacher endpoints
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { User, Student, Teacher } from "@/models";
import { updateTeacherProfileSchema } from "@/lib/validation/teacher.schema";
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
import { GET, PATCH } from "@/app/api/teachers/me/route";

// Typed mock — avoids NextMiddleware overload resolution confusion at build time
const authMock = vi.mocked(auth) as unknown as {
  mockResolvedValueOnce: (val: Session | null) => void;
};

// ============================================================
// Test DB setup
// ============================================================
let mongod: MongoMemoryReplSet;

let teacherUserId: string;
let teacherMongoId: string;
let otherTeacherUserId: string;
let studentUserId: string;

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  await Promise.all([User.init(), Student.init(), Teacher.init()]);

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash("Password123!", salt);

  // Teacher 1 (authenticated test teacher)
  const u1 = await User.create({ email: "vance@test.edu", passwordHash: hash, role: "teacher", isActive: true });
  const t1 = await Teacher.create({ userId: u1._id, fullName: "Dr. Robert Vance" });
  teacherUserId = u1._id.toString();
  teacherMongoId = t1._id.toString();

  // Teacher 2 (another teacher)
  const u2 = await User.create({ email: "other@test.edu", passwordHash: hash, role: "teacher", isActive: true });
  await Teacher.create({ userId: u2._id, fullName: "Prof. Other" });
  otherTeacherUserId = u2._id.toString();

  // Student
  const u3 = await User.create({ email: "student@test.edu", passwordHash: hash, role: "student", isActive: true });
  await Student.create({ userId: u3._id, studentCode: "STU-5000", fullName: "Alice Smith" });
  studentUserId = u3._id.toString();
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
  const url = "http://localhost:3000/api/teachers/me";
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
// GET /api/teachers/me
// ============================================================
describe("GET /api/teachers/me", () => {
  it("returns 401 when no session exists", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when session belongs to a student", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: studentUserId, email: "student@test.edu", role: "student", fullName: "Alice Smith" })
    );
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error.code).toBe("FORBIDDEN");
  });

  it("returns own profile for authenticated teacher", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: teacherUserId, email: "vance@test.edu", role: "teacher", fullName: "Dr. Robert Vance" })
    );
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.email).toBe("vance@test.edu");
    expect(data.data.fullName).toBe("Dr. Robert Vance");
    expect(data.data.teacherId).toBe(teacherMongoId);
  });

  it("SECURITY: response is scoped to the session userId — no other teacher's data is accessible", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: teacherUserId, email: "vance@test.edu", role: "teacher", fullName: "Dr. Robert Vance" })
    );
    const res = await GET();
    const data = await res.json();
    expect(data.data.fullName).toBe("Dr. Robert Vance");
    expect(JSON.stringify(data)).not.toContain(otherTeacherUserId);
  });
});

// ============================================================
// PATCH /api/teachers/me
// ============================================================
describe("PATCH /api/teachers/me", () => {
  it("returns 401 when no session", async () => {
    authMock.mockResolvedValueOnce(null);
    const req = makeRequest("PATCH", { fullName: "Updated Name" });
    const res = await PATCH(req);
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when session belongs to a student", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: studentUserId, email: "student@test.edu", role: "student", fullName: "Alice Smith" })
    );
    const req = makeRequest("PATCH", { fullName: "Updated Name" });
    const res = await PATCH(req);
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 on validation failure (empty name)", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: teacherUserId, email: "vance@test.edu", role: "teacher", fullName: "Dr. Robert Vance" })
    );
    const req = makeRequest("PATCH", { fullName: "" });
    const res = await PATCH(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
  });

  it("returns 400 on validation failure (name too short)", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: teacherUserId, email: "vance@test.edu", role: "teacher", fullName: "Dr. Robert Vance" })
    );
    const req = makeRequest("PATCH", { fullName: "D" });
    const res = await PATCH(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
  });

  it("SECURITY: ignores teacherId, userId, role fields injected in body", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: teacherUserId, email: "vance@test.edu", role: "teacher", fullName: "Dr. Robert Vance" })
    );
    const req = makeRequest("PATCH", {
      fullName: "Dr. Vance Renamed",
      teacherId: "00000000deadbeefcafebabe", // ignored
      userId: otherTeacherUserId,            // ignored
      role: "student",                       // ignored
    });
    const res = await PATCH(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    const updatedTeacher = await Teacher.findOne({ userId: teacherUserId });
    expect(updatedTeacher?.fullName).toBe("Dr. Vance Renamed");
  });

  it("successfully updates fullName and persists to database", async () => {
    authMock.mockResolvedValueOnce(
      mockSession({ id: teacherUserId, email: "vance@test.edu", role: "teacher", fullName: "Dr. Robert Vance" })
    );
    const req = makeRequest("PATCH", { fullName: "Prof. Robert Vance" });
    const res = await PATCH(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.fullName).toBe("Prof. Robert Vance");
    const inDb = await Teacher.findOne({ userId: teacherUserId });
    expect(inDb?.fullName).toBe("Prof. Robert Vance");
  });
});

// ============================================================
// Zod schema unit tests (no DB needed)
// ============================================================
describe("updateTeacherProfileSchema validation", () => {
  it("accepts valid full name", () => {
    const r = updateTeacherProfileSchema.safeParse({ fullName: "Prof. Vance" });
    expect(r.success).toBe(true);
  });

  it("rejects empty string", () => {
    const r = updateTeacherProfileSchema.safeParse({ fullName: "" });
    expect(r.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const r = updateTeacherProfileSchema.safeParse({ fullName: "P".repeat(101) });
    expect(r.success).toBe(false);
  });

  it("trims whitespace from fullName", () => {
    const r = updateTeacherProfileSchema.safeParse({ fullName: "  Robert Vance  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fullName).toBe("Robert Vance");
  });

  it("does not pass extra forbidden fields through (Zod strips unknown keys)", () => {
    const r = updateTeacherProfileSchema.safeParse({ fullName: "Valid Name", role: "student" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>).role).toBeUndefined();
    }
  });
});
