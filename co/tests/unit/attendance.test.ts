/**
 * Phase 10 — Attendance Validation & Recording Tests
 *
 * Tests:
 *  - Valid attendance succeeds
 *  - Expired token is rejected
 *  - Unknown token is rejected
 *  - Stopped session is rejected
 *  - Non-enrolled student is rejected
 *  - Student with no registered device is rejected
 *  - Student using mismatched deviceUuid is rejected
 *  - Duplicate scan of same session by same student is rejected with "already marked" (duplicate key check)
 *  - Request body serverTimestamp and status fields are ignored
 *  - Rapid repeated requests are rate-limited
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { User, Student, Teacher, Class, Subject, Enrollment, Device, AttendanceSession, AttendanceRecord } from "@/models";
import { clearRateLimitStore } from "@/lib/rate-limit";
import type { Session } from "next-auth";

// ============================================================
// Module mocks
// ============================================================
vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock("@/lib/mongodb/connection", () => ({ connectToDatabase: vi.fn().mockResolvedValue(undefined) }));

import { auth } from "@/lib/auth/auth";
import { POST as markAttendance } from "@/app/api/attendance/mark/route";

const authMock = vi.mocked(auth) as unknown as { mockResolvedValueOnce: (v: Session | null) => void };

// ============================================================
// DB Setup
// ============================================================
let mongod: MongoMemoryReplSet;
let studentUserId: string;
let studentMongoId: string;
let unregisteredStudentUserId: string;
let unregisteredStudentMongoId: string;
let nonEnrolledStudentUserId: string;
let nonEnrolledStudentMongoId: string;

let classId: string;
let subjectId: string;
let activeToken: string;
let expiredToken: string;
let stoppedToken: string;
let deviceUuid = "123e4567-e89b-12d3-a456-426614174000";

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
  await Promise.all([
    User.init(),
    Student.init(),
    Teacher.init(),
    Class.init(),
    Subject.init(),
    Enrollment.init(),
    Device.init(),
    AttendanceSession.init(),
    AttendanceRecord.init(),
  ]);

  const hash = await bcrypt.hash("Password123!", 10);

  // Setup Student 1 (Enrolled, with Device)
  const u1 = await User.create({ email: "s1@test.edu", passwordHash: hash, role: "student", isActive: true });
  const s1 = await Student.create({ userId: u1._id, studentCode: "STU-1111", fullName: "Student One" });
  studentUserId = u1._id.toString();
  studentMongoId = s1._id.toString();
  await Device.create({ studentId: s1._id, deviceUuid, status: "active" });

  // Setup Student 2 (Enrolled, NO Device)
  const u2 = await User.create({ email: "s2@test.edu", passwordHash: hash, role: "student", isActive: true });
  const s2 = await Student.create({ userId: u2._id, studentCode: "STU-2222", fullName: "Student Two" });
  unregisteredStudentUserId = u2._id.toString();
  unregisteredStudentMongoId = s2._id.toString();

  // Setup Student 3 (Not Enrolled, has Device)
  const u3 = await User.create({ email: "s3@test.edu", passwordHash: hash, role: "student", isActive: true });
  const s3 = await Student.create({ userId: u3._id, studentCode: "STU-3333", fullName: "Student Three" });
  nonEnrolledStudentUserId = u3._id.toString();
  nonEnrolledStudentMongoId = s3._id.toString();
  await Device.create({ studentId: s3._id, deviceUuid: "987f6543-e21b-32d1-b654-426614174111", status: "active" });

  // Teacher & Class & Subject Setup
  const ut = await User.create({ email: "t1@test.edu", passwordHash: hash, role: "teacher", isActive: true });
  const t1 = await Teacher.create({ userId: ut._id, fullName: "Prof. T" });
  const cls = await Class.create({ name: "CS-101", academicTerm: "Fall 2026", teacherId: t1._id, isActive: true });
  classId = cls._id.toString();
  const sub = await Subject.create({ name: "Raft", classId: cls._id });
  subjectId = sub._id.toString();

  // Create Enrollments
  await Enrollment.create({ studentId: s1._id, classId: cls._id, status: "active" });
  await Enrollment.create({ studentId: s2._id, classId: cls._id, status: "active" });

  // Create QR Sessions
  // 1. Active QR Session
  activeToken = "active-token-999";
  await AttendanceSession.create({
    classId: cls._id,
    subjectId: sub._id,
    teacherId: t1._id,
    token: activeToken,
    status: "active",
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 60000),
  });

  // 2. Expired QR Session
  expiredToken = "expired-token-888";
  await AttendanceSession.create({
    classId: cls._id,
    subjectId: sub._id,
    teacherId: t1._id,
    token: expiredToken,
    status: "active", // server checks will mark expired
    startedAt: new Date(Date.now() - 120000),
    expiresAt: new Date(Date.now() - 60000),
  });

  // 3. Stopped QR Session
  stoppedToken = "stopped-token-777";
  await AttendanceSession.create({
    classId: cls._id,
    subjectId: sub._id,
    teacherId: t1._id,
    token: stoppedToken,
    status: "stopped",
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 60000),
    stoppedAt: new Date(),
  });
}, 30_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(() => {
  vi.clearAllMocks();
  (auth as any).mockReset();
  clearRateLimitStore(); // Reset rate limits between tests
});

// ============================================================
// Helpers
// ============================================================
function mockSession(id: string, email: string, role: "student" | "teacher"): Session {
  return {
    user: { id, email, role, fullName: "Test Student", name: "Test Student", image: null, emailVerified: null },
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
describe("Attendance Validation & Recording (Phase 10)", () => {
  it("succeeds for valid scans containing correct token & deviceUuid", async () => {
    authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
    const req = makeRequest("POST", "http://localhost:3000/api/attendance/mark", {
      token: activeToken,
      deviceUuid,
    });
    const res = await markAttendance(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.serverTimestamp).toBeDefined();

    // Verify DB entry is created
    const record = await AttendanceRecord.findOne({ studentId: studentMongoId });
    expect(record).toBeDefined();
    expect(record?.status).toBe("present");
  });

  it("rejects scans with expired tokens", async () => {
    authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
    const req = makeRequest("POST", "http://localhost:3000/api/attendance/mark", {
      token: expiredToken,
      deviceUuid,
    });
    const res = await markAttendance(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("SESSION_INACTIVE");
  });

  it("rejects scans with unknown/invalid tokens", async () => {
    authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
    const req = makeRequest("POST", "http://localhost:3000/api/attendance/mark", {
      token: "unknown-token-value",
      deviceUuid,
    });
    const res = await markAttendance(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("INVALID_TOKEN");
  });

  it("rejects scans from stopped sessions", async () => {
    authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
    const req = makeRequest("POST", "http://localhost:3000/api/attendance/mark", {
      token: stoppedToken,
      deviceUuid,
    });
    const res = await markAttendance(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("SESSION_INACTIVE");
  });

  it("rejects scans from students who are not enrolled in the class", async () => {
    authMock.mockResolvedValueOnce(mockSession(nonEnrolledStudentUserId, "s3@test.edu", "student"));
    const req = makeRequest("POST", "http://localhost:3000/api/attendance/mark", {
      token: activeToken,
      deviceUuid: "987f6543-e21b-32d1-b654-426614174111",
    });
    const res = await markAttendance(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("NOT_ENROLLED");
  });

  it("rejects scans from students who have no registered browser device", async () => {
    authMock.mockResolvedValueOnce(mockSession(unregisteredStudentUserId, "s2@test.edu", "student"));
    const req = makeRequest("POST", "http://localhost:3000/api/attendance/mark", {
      token: activeToken,
      deviceUuid,
    });
    const res = await markAttendance(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("DEVICE_MISMATCH");
  });

  it("rejects scans from students using a mismatched deviceUuid", async () => {
    authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
    const req = makeRequest("POST", "http://localhost:3000/api/attendance/mark", {
      token: activeToken,
      deviceUuid: "00000000-0000-0000-0000-000000000000", // Wrong UUID
    });
    const res = await markAttendance(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("DEVICE_MISMATCH");
  });

  it("rejects duplicate scans with ALREADY_MARKED code", async () => {
    // Attempt duplicate scanning
    authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
    const req = makeRequest("POST", "http://localhost:3000/api/attendance/mark", {
      token: activeToken,
      deviceUuid,
    });
    const res = await markAttendance(req);
    const data = await res.json();

    expect(res.status).toBe(409); // Conflict
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("ALREADY_MARKED");
  });

  it("ignores client-supplied serverTimestamp and status in request body", async () => {
    // Delete any old record for this test case
    await AttendanceRecord.deleteMany({ studentId: studentMongoId });

    authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
    const req = makeRequest("POST", "http://localhost:3000/api/attendance/mark", {
      token: activeToken,
      deviceUuid,
      status: "absent", // Client tries to override status
      serverTimestamp: "2099-01-01T00:00:00.000Z", // Client tries to override timestamp
    });
    const res = await markAttendance(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const record = await AttendanceRecord.findOne({ studentId: studentMongoId });
    expect(record?.status).toBe("present"); // Remains present
    expect(record?.serverTimestamp.getFullYear()).toBeLessThan(2030); // Not overridden to 2099
  });

  it("applies rate limiting on rapid repeated requests", async () => {
    // Clear rates first
    clearRateLimitStore();

    // Student makes 3 successful/unsuccessful requests (limits studentId to 3 per 10s)
    for (let i = 0; i < 3; i++) {
      authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
      const req = makeRequest("POST", "http://localhost:3000/api/attendance/mark", {
        token: activeToken,
        deviceUuid,
      });
      await markAttendance(req);
    }

    // 4th request must trigger rate limiter
    authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
    const req = makeRequest("POST", "http://localhost:3000/api/attendance/mark", {
      token: activeToken,
      deviceUuid,
    });
    const res = await markAttendance(req);
    const data = await res.json();

    expect(res.status).toBe(429); // Too Many Requests
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
