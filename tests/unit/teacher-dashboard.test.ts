/**
 * Phase 12 — Teacher Dashboard Integration & Live Roster Tests
 *
 * Tests:
 *  - Teacher only sees their own sessions/classes/students (data isolation)
 *  - Live endpoint checks teacher class ownership boundaries
 *  - Live endpoint reflects new check-in records immediately
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { User, Student, Teacher, Class, Subject, Enrollment, Device, AttendanceSession, AttendanceRecord } from "@/models";
import type { Session } from "next-auth";

// ============================================================
// Module mocks
// ============================================================
vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock("@/lib/mongodb/connection", () => ({ connectToDatabase: vi.fn().mockResolvedValue(undefined) }));

import { auth } from "@/lib/auth/auth";
import { GET as getOverview } from "@/app/api/teachers/me/overview/route";
import { GET as getLiveRoster } from "@/app/api/attendance/session/[sessionId]/live/route";

const authMock = vi.mocked(auth) as unknown as { mockResolvedValueOnce: (v: Session | null) => void };

// ============================================================
// DB Setup
// ============================================================
let mongod: MongoMemoryReplSet;

// Teacher 1 (owns Class A, Subject A)
let teacher1UserId: string;
let teacher1MongoId: string;

// Teacher 2 (owns Class B, Subject B)
let teacher2UserId: string;
let teacher2MongoId: string;

let class1Id: string;
let class2Id: string;
let subject1Id: string;

let session1Id: string;
let studentMongoId: string;

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

  // Setup Teacher 1 & Class 1
  const ut1 = await User.create({ email: "t1@test.edu", passwordHash: hash, role: "teacher", isActive: true });
  const t1 = await Teacher.create({ userId: ut1._id, fullName: "Prof Xavier" });
  teacher1UserId = ut1._id.toString();
  teacher1MongoId = t1._id.toString();

  const c1 = await Class.create({ name: "Telepathy 101", academicTerm: "Fall 2026", teacherId: t1._id, isActive: true });
  class1Id = c1._id.toString();
  const sub1 = await Subject.create({ name: "Cerebro Ops", classId: c1._id });
  subject1Id = sub1._id.toString();

  // Setup Teacher 2 & Class 2
  const ut2 = await User.create({ email: "t2@test.edu", passwordHash: hash, role: "teacher", isActive: true });
  const t2 = await Teacher.create({ userId: ut2._id, fullName: "Magneto" });
  teacher2UserId = ut2._id.toString();
  teacher2MongoId = t2._id.toString();

  const c2 = await Class.create({ name: "Magnetic Physics", academicTerm: "Fall 2026", teacherId: t2._id, isActive: true });
  class2Id = c2._id.toString();

  // Setup student enrolled in Class 1 (Teacher 1)
  const us = await User.create({ email: "s1@test.edu", passwordHash: hash, role: "student", isActive: true });
  const s1 = await Student.create({ userId: us._id, studentCode: "STU-007", fullName: "Wolverine" });
  studentMongoId = s1._id.toString();

  // Enroll wolverine in Class 1
  const enrolledAt = new Date(Date.now() - 3600000);
  await Enrollment.create({ studentId: s1._id, classId: c1._id, status: "active", enrolledAt });

  // Create an active session for Class 1 (Teacher 1)
  const qrs = await AttendanceSession.create({
    classId: c1._id,
    subjectId: sub1._id,
    teacherId: t1._id,
    token: "token-teacher1-active",
    status: "active",
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 600000), // Active for 10 minutes
  });
  session1Id = qrs._id.toString();

  // Add 1 check-in record for Student 1
  await AttendanceRecord.create({
    sessionId: qrs._id,
    studentId: s1._id,
    classId: c1._id,
    subjectId: sub1._id,
    deviceId: new mongoose.Types.ObjectId(),
    status: "present",
    serverTimestamp: new Date(),
  });
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
function mockTeacherSession(id: string, email: string): Session {
  return {
    user: { id, email, role: "teacher", fullName: "Test Instructor", name: "Test Instructor", image: null, emailVerified: null },
    expires: "2099-01-01",
  } as unknown as Session;
}

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: "GET",
    headers: new Headers({ origin: "http://localhost:3000" }),
  });
}

// ============================================================
// Tests
// ============================================================
describe("Teacher Dashboard & Live Summary API (Phase 12)", () => {
  describe("GET /api/teachers/me/overview", () => {
    it("returns classes and active session details for Teacher 1", async () => {
      authMock.mockResolvedValueOnce(mockTeacherSession(teacher1UserId, "t1@test.edu"));

      const res = await getOverview(makeRequest("http://localhost:3000/api/teachers/me/overview"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      // Verify Teacher 1 sees Class 1
      const ownedClasses = body.data.classes;
      expect(ownedClasses.length).toBe(1);
      expect(ownedClasses[0].name).toBe("Telepathy 101");

      // Verify Teacher 1 sees active session
      const activeSession = body.data.activeSession;
      expect(activeSession).toBeDefined();
      expect(activeSession.sessionId).toBe(session1Id);
      expect(activeSession.attendanceCount).toBe(1); // Wolverine checked in
    });

    it("isolates overview data so Teacher 2 does not see Teacher 1's details", async () => {
      authMock.mockResolvedValueOnce(mockTeacherSession(teacher2UserId, "t2@test.edu"));

      const res = await getOverview(makeRequest("http://localhost:3000/api/teachers/me/overview"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);

      // Verify Teacher 2 sees Class 2 (Magnetic Physics)
      const ownedClasses = body.data.classes;
      expect(ownedClasses.length).toBe(1);
      expect(ownedClasses[0].name).toBe("Magnetic Physics");

      // Verify Teacher 2 sees NO active session (since they haven't launched one)
      expect(body.data.activeSession).toBeNull();
    });
  });

  describe("GET /api/attendance/session/[sessionId]/live", () => {
    it("allows the owning teacher to fetch live attendance list", async () => {
      authMock.mockResolvedValueOnce(mockTeacherSession(teacher1UserId, "t1@test.edu"));

      const res = await getLiveRoster(
        makeRequest(`http://localhost:3000/api/attendance/session/${session1Id}/live`),
        { params: Promise.resolve({ sessionId: session1Id }) }
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.count).toBe(1);
      expect(body.data.attendees[0].fullName).toBe("Wolverine");
    });

    it("rejects non-owner teacher requests with 403 Forbidden", async () => {
      authMock.mockResolvedValueOnce(mockTeacherSession(teacher2UserId, "t2@test.edu"));

      const res = await getLiveRoster(
        makeRequest(`http://localhost:3000/api/attendance/session/${session1Id}/live`),
        { params: Promise.resolve({ sessionId: session1Id }) }
      );
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("reflects newly created records in subsequent calls immediately", async () => {
      // Mock another student
      const uStudent2 = await User.create({ email: "s2@test.edu", passwordHash: "dummy", role: "student", isActive: true });
      const student2 = await Student.create({ userId: uStudent2._id, studentCode: "STU-008", fullName: "Cyclops" });

      // Call 1: returns 1 checked-in
      authMock.mockResolvedValueOnce(mockTeacherSession(teacher1UserId, "t1@test.edu"));
      let res = await getLiveRoster(
        makeRequest(`http://localhost:3000/api/attendance/session/${session1Id}/live`),
        { params: Promise.resolve({ sessionId: session1Id }) }
      );
      let body = await res.json();
      expect(body.data.count).toBe(1);

      // Create a second check-in record for Cyclops
      await AttendanceRecord.create({
        sessionId: new mongoose.Types.ObjectId(session1Id),
        studentId: student2._id,
        classId: new mongoose.Types.ObjectId(class1Id),
        subjectId: new mongoose.Types.ObjectId(subject1Id),
        deviceId: new mongoose.Types.ObjectId(),
        status: "present",
        serverTimestamp: new Date(),
      });

      // Call 2: reflects new check-in immediately (count = 2)
      authMock.mockResolvedValueOnce(mockTeacherSession(teacher1UserId, "t1@test.edu"));
      res = await getLiveRoster(
        makeRequest(`http://localhost:3000/api/attendance/session/${session1Id}/live`),
        { params: Promise.resolve({ sessionId: session1Id }) }
      );
      body = await res.json();
      expect(body.data.count).toBe(2);
      expect(body.data.attendees[0].fullName).toBe("Cyclops");
    });
  });
});
