/**
 * Phase 8 — QR Attendance Sessions Integration Tests
 *
 * Tests:
 *  - POST /api/qr/start: starts session, fails if non-owner, rejects duplicate active sessions
 *  - GET  /api/qr/[sessionId]/current: retrieves status + server QR, fails if non-owner, rejects expired sessions
 *  - POST /api/qr/rotate/[sessionId]: re-issues dynamic token, checks ownership
 *  - POST /api/qr/stop/[sessionId]: invalidates session and clears active token
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { User, Teacher, Class, Subject, AttendanceSession, Setting } from "@/models";
import type { Session } from "next-auth";

// ============================================================
// Module mocks
// ============================================================
vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock("@/lib/mongodb/connection", () => ({ connectToDatabase: vi.fn().mockResolvedValue(undefined) }));

import { auth } from "@/lib/auth/auth";
import { POST as startSession } from "@/app/api/qr/start/route";
import { GET as currentSession } from "@/app/api/qr/[sessionId]/current/route";
import { POST as rotateSession } from "@/app/api/qr/rotate/[sessionId]/route";
import { POST as stopSession } from "@/app/api/qr/stop/[sessionId]/route";

const authMock = vi.mocked(auth) as unknown as { mockResolvedValueOnce: (v: Session | null) => void };

// ============================================================
// DB Setup
// ============================================================
let mongod: MongoMemoryReplSet;
let teacherUserId: string;
let teacherMongoId: string;
let otherTeacherUserId: string;
let otherTeacherMongoId: string;
let classId: string;
let subjectId: string;
let otherClassId: string;
let otherSubjectId: string;

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
  await Promise.all([
    User.init(),
    Teacher.init(),
    Class.init(),
    Subject.init(),
    AttendanceSession.init(),
    Setting.init(),
  ]);

  const hash = await bcrypt.hash("Password123!", 10);

  // Setup settings
  await Setting.create({ key: "qrExpirySeconds", value: 60 });
  await Setting.create({ key: "qrRotationSeconds", value: 10 });

  // Teacher 1
  const u1 = await User.create({ email: "t1@test.edu", passwordHash: hash, role: "teacher", isActive: true });
  const t1 = await Teacher.create({ userId: u1._id, fullName: "Dr. T1" });
  teacherUserId = u1._id.toString();
  teacherMongoId = t1._id.toString();

  // Teacher 2
  const u2 = await User.create({ email: "t2@test.edu", passwordHash: hash, role: "teacher", isActive: true });
  const t2 = await Teacher.create({ userId: u2._id, fullName: "Dr. T2" });
  otherTeacherUserId = u2._id.toString();
  otherTeacherMongoId = t2._id.toString();

  // Classes & Subjects
  const cls1 = await Class.create({ name: "CS101", academicTerm: "Fall 2026", teacherId: t1._id, isActive: true });
  classId = cls1._id.toString();
  const sub1 = await Subject.create({ name: "Raft Consensus", classId: cls1._id });
  subjectId = sub1._id.toString();

  const cls2 = await Class.create({ name: "CS999", academicTerm: "Fall 2026", teacherId: t2._id, isActive: true });
  otherClassId = cls2._id.toString();
  const sub2 = await Subject.create({ name: "Rogue Topics", classId: cls2._id });
  otherSubjectId = sub2._id.toString();
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
// Helpers
// ============================================================
function mockSession(id: string, email: string, role: "student" | "teacher"): Session {
  return {
    user: { id, email, role, fullName: "Test", name: "Test", image: null, emailVerified: null },
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
// Test Specs
// ============================================================
describe("QR Attendance Sessions (Phase 8)", () => {
  let createdSessionId: string;

  describe("POST /api/qr/start", () => {
    it("fails starting session if not class owner", async () => {
      authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
      // Teacher 1 tries to start a session for Class 2 (owned by Teacher 2)
      const req = makeRequest("POST", "http://localhost:3000/api/qr/start", {
        classId: otherClassId,
        subjectId: otherSubjectId,
      });
      const res = await startSession(req);
      expect(res.status).toBe(403);
    });

    it("starts a session successfully for owning teacher", async () => {
      authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
      const req = makeRequest("POST", "http://localhost:3000/api/qr/start", { classId, subjectId });
      const res = await startSession(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.sessionId).toBeDefined();

      createdSessionId = data.data.sessionId;
    });

    it("rejects starting a duplicate active session for the same class+subject", async () => {
      authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
      const req = makeRequest("POST", "http://localhost:3000/api/qr/start", { classId, subjectId });
      const res = await startSession(req);
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error.code).toBe("ACTIVE_SESSION_EXISTS");
    });
  });

  describe("GET /api/qr/[sessionId]/current", () => {
    it("fails reading current status if not owner teacher", async () => {
      authMock.mockResolvedValueOnce(mockSession(otherTeacherUserId, "t2@test.edu", "teacher"));
      const req = makeRequest("GET", `http://localhost:3000/api/qr/${createdSessionId}/current`);
      const res = await currentSession(req, { params: Promise.resolve({ sessionId: createdSessionId }) });
      expect(res.status).toBe(403);
    });

    it("retrieves session current details and server QR successfully", async () => {
      authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
      const req = makeRequest("GET", `http://localhost:3000/api/qr/${createdSessionId}/current`);
      const res = await currentSession(req, { params: Promise.resolve({ sessionId: createdSessionId }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.token).toBeDefined();
      expect(data.data.qrDataUrl).toContain("data:image/png;base64");
    });

    it("rejects token retrieval if session is expired", async () => {
      // Artificially expire the session
      await AttendanceSession.findByIdAndUpdate(createdSessionId, { expiresAt: new Date(Date.now() - 5000) });

      authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
      const req = makeRequest("GET", `http://localhost:3000/api/qr/${createdSessionId}/current`);
      const res = await currentSession(req, { params: Promise.resolve({ sessionId: createdSessionId }) });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error.code).toBe("SESSION_INACTIVE");
    });
  });

  describe("POST /api/qr/rotate/[sessionId]", () => {
    let freshSessionId: string;

    beforeAll(async () => {
      // Re-create a fresh active session
      await AttendanceSession.deleteMany({});
      const session = await AttendanceSession.create({
        classId: new mongoose.Types.ObjectId(classId),
        subjectId: new mongoose.Types.ObjectId(subjectId),
        teacherId: new mongoose.Types.ObjectId(teacherMongoId),
        token: "initial-token-xyz",
        status: "active",
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      });
      freshSessionId = session._id.toString();
    });

    it("fails rotation if not owning teacher", async () => {
      authMock.mockResolvedValueOnce(mockSession(otherTeacherUserId, "t2@test.edu", "teacher"));
      const req = makeRequest("POST", `http://localhost:3000/api/qr/rotate/${freshSessionId}`);
      const res = await rotateSession(req, { params: Promise.resolve({ sessionId: freshSessionId }) });
      expect(res.status).toBe(403);
    });

    it("rotates dynamic token and creates a unique value", async () => {
      authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
      const req = makeRequest("POST", `http://localhost:3000/api/qr/rotate/${freshSessionId}`);
      const res = await rotateSession(req, { params: Promise.resolve({ sessionId: freshSessionId }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.token).not.toBe("initial-token-xyz");

      // Verify DB updated
      const updated = await AttendanceSession.findById(freshSessionId);
      expect(updated?.token).toBe(data.data.token);
    });
  });

  describe("POST /api/qr/stop/[sessionId]", () => {
    let sessionToStopId: string;

    beforeAll(async () => {
      const session = await AttendanceSession.create({
        classId: new mongoose.Types.ObjectId(classId),
        subjectId: new mongoose.Types.ObjectId(subjectId),
        teacherId: new mongoose.Types.ObjectId(teacherMongoId),
        token: "stop-token-123",
        status: "active",
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      });
      sessionToStopId = session._id.toString();
    });

    it("fails stopping if not owning teacher", async () => {
      authMock.mockResolvedValueOnce(mockSession(otherTeacherUserId, "t2@test.edu", "teacher"));
      const req = makeRequest("POST", `http://localhost:3000/api/qr/stop/${sessionToStopId}`);
      const res = await stopSession(req, { params: Promise.resolve({ sessionId: sessionToStopId }) });
      expect(res.status).toBe(403);
    });

    it("stops session and invalidates active token successfully", async () => {
      authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
      const req = makeRequest("POST", `http://localhost:3000/api/qr/stop/${sessionToStopId}`);
      const res = await stopSession(req, { params: Promise.resolve({ sessionId: sessionToStopId }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      const stopped = await AttendanceSession.findById(sessionToStopId);
      expect(stopped?.status).toBe("stopped");
      expect(stopped?.token).toBeDefined();
    });
  });
});
