/**
 * Phase 11 — Student Dashboard Integration & Attendance Summary Tests
 *
 * Tests:
 *  - Percentage calculation correctness for 100%, 75%, below threshold
 *  - Zero-classes-held cases (no division-by-zero or NaN errors, returns 0/0)
 *  - A student only ever sees their own data regardless of any session details
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { User, Student, Teacher, Class, Subject, Enrollment, Device, AttendanceSession, AttendanceRecord, Setting } from "@/models";
import type { Session } from "next-auth";

// ============================================================
// Module mocks
// ============================================================
vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock("@/lib/mongodb/connection", () => ({ connectToDatabase: vi.fn().mockResolvedValue(undefined) }));

import { auth } from "@/lib/auth/auth";
import { GET as getSummary } from "@/app/api/students/me/attendance-summary/route";
import { clearSettingsCache } from "@/lib/settings";

const authMock = vi.mocked(auth) as unknown as { mockResolvedValueOnce: (v: Session | null) => void };

// ============================================================
// DB Setup
// ============================================================
let mongod: MongoMemoryReplSet;

// Student 1 (Enrolled in Class A, has attended sessions)
let student1UserId: string;
let student1MongoId: string;

// Student 2 (Enrolled in Class A, has attended NONE, zero held for Subject B)
let student2UserId: string;
let student2MongoId: string;

// Class & Subject references
let classId: string;
let subject1Id: string;
let subject2Id: string;

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
    Setting.init(),
  ]);

  const hash = await bcrypt.hash("Password123!", 10);

  // Setup Student 1
  const u1 = await User.create({ email: "student1@test.edu", passwordHash: hash, role: "student", isActive: true });
  const s1 = await Student.create({ userId: u1._id, studentCode: "STU-0001", fullName: "Student One" });
  student1UserId = u1._id.toString();
  student1MongoId = s1._id.toString();

  // Setup Student 2
  const u2 = await User.create({ email: "student2@test.edu", passwordHash: hash, role: "student", isActive: true });
  const s2 = await Student.create({ userId: u2._id, studentCode: "STU-0002", fullName: "Student Two" });
  student2UserId = u2._id.toString();
  student2MongoId = s2._id.toString();

  // Setup Teacher, Class, Subjects
  const ut = await User.create({ email: "teacher1@test.edu", passwordHash: hash, role: "teacher", isActive: true });
  const t1 = await Teacher.create({ userId: ut._id, fullName: "Professor Xavier" });
  const cls = await Class.create({ name: "Mutant Studies", academicTerm: "Fall 2026", teacherId: t1._id, isActive: true });
  classId = cls._id.toString();

  // Subject 1: Will have 4 sessions held
  const sub1 = await Subject.create({ name: "Telepathy 101", classId: cls._id });
  subject1Id = sub1._id.toString();

  // Subject 2: Will have 0 sessions held (to test 0/0 edge case)
  const sub2 = await Subject.create({ name: "Cerebro Ops", classId: cls._id });
  subject2Id = sub2._id.toString();

  // Enroll both students (enrolledAt 1 hour ago)
  const enrolledAt = new Date(Date.now() - 3600000);
  await Enrollment.create({ studentId: s1._id, classId: cls._id, status: "active", enrolledAt });
  await Enrollment.create({ studentId: s2._id, classId: cls._id, status: "active", enrolledAt });

  // Create 4 sessions for Subject 1
  const sessions = [];
  for (let i = 0; i < 4; i++) {
    const session = await AttendanceSession.create({
      classId: cls._id,
      subjectId: sub1._id,
      teacherId: t1._id,
      token: `token-sub1-sess-${i}`,
      status: "expired",
      startedAt: new Date(Date.now() - 1000 * 60 * (10 - i)),
      expiresAt: new Date(Date.now() - 1000 * 60 * (9 - i)),
    });
    sessions.push(session);
  }

  // Attendance Records for Student 1:
  // We want to test different percentage thresholds:
  // Let's mark Student 1 as present in 3 out of 4 sessions for Subject 1 -> 3/4 = 75%
  const deviceId = new mongoose.Types.ObjectId();
  for (let i = 0; i < 3; i++) {
    await AttendanceRecord.create({
      sessionId: sessions[i]._id,
      studentId: s1._id,
      classId: cls._id,
      subjectId: sub1._id,
      deviceId,
      status: "present",
      serverTimestamp: new Date(),
    });
  }

  // Student 2 has attended 0 sessions
}, 30_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(() => {
  vi.clearAllMocks();
  (auth as any).mockReset();
  clearSettingsCache();
});

// ============================================================
// Helpers
// ============================================================
function mockSession(id: string, email: string): Session {
  return {
    user: { id, email, role: "student", fullName: "Test Student", name: "Test Student", image: null, emailVerified: null },
    expires: "2099-01-01",
  } as unknown as Session;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/students/me/attendance-summary", {
    method: "GET",
    headers: new Headers({ origin: "http://localhost:3000" }),
  });
}

// ============================================================
// Tests
// ============================================================
describe("Student Attendance Summary API (Phase 11)", () => {
  it("calculates exact percentage (75% threshold match)", async () => {
    // Subject 1: Student 1 has 3/4 = 75%
    authMock.mockResolvedValueOnce(mockSession(student1UserId, "student1@test.edu"));

    const res = await getSummary(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const sub1Summary = body.data.subjects.find((s: any) => s.subjectId === subject1Id);
    expect(sub1Summary).toBeDefined();
    expect(sub1Summary.attended).toBe(3);
    expect(sub1Summary.held).toBe(4);
    expect(sub1Summary.percentage).toBe(75);
    expect(sub1Summary.belowThreshold).toBe(false); // 75 is exactly the default threshold (>= 75 is safe)
  });

  it("identifies below threshold stats accurately", async () => {
    // Modify setting to 80% to force 75% to be below threshold
    await Setting.findOneAndUpdate(
      { key: "attendanceThreshold" },
      { value: "80", isPublic: true },
      { upsert: true }
    );

    authMock.mockResolvedValueOnce(mockSession(student1UserId, "student1@test.edu"));

    const res = await getSummary(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const sub1Summary = body.data.subjects.find((s: any) => s.subjectId === subject1Id);
    expect(sub1Summary.percentage).toBe(75);
    expect(sub1Summary.belowThreshold).toBe(true); // 75 < 80, triggers warning flags

    // Restore threshold
    await Setting.findOneAndUpdate({ key: "attendanceThreshold" }, { value: "75" });
  });

  it("handles zero sessions held gracefully with 0/0 ratio (no NaN errors)", async () => {
    // Subject 2 has 0 sessions held. Verify summary reports 0/0 and 0%
    authMock.mockResolvedValueOnce(mockSession(student1UserId, "student1@test.edu"));

    const res = await getSummary(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);

    const sub2Summary = body.data.subjects.find((s: any) => s.subjectId === subject2Id);
    expect(sub2Summary).toBeDefined();
    expect(sub2Summary.attended).toBe(0);
    expect(sub2Summary.held).toBe(0);
    expect(sub2Summary.percentage).toBe(0); // Not NaN or null
    expect(sub2Summary.belowThreshold).toBe(false);
  });

  it("isolates data so a student only sees their own summary", async () => {
    // Student 2 has enrolled, but has attended 0 sessions.
    // Verify Student 2 receives 0/4 and 0% for Subject 1, completely isolated from Student 1's records.
    authMock.mockResolvedValueOnce(mockSession(student2UserId, "student2@test.edu"));

    const res = await getSummary(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Subject 1 for Student 2: should be 0/4
    const sub1Summary = body.data.subjects.find((s: any) => s.subjectId === subject1Id);
    expect(sub1Summary.attended).toBe(0);
    expect(sub1Summary.held).toBe(4);
    expect(sub1Summary.percentage).toBe(0);
    expect(sub1Summary.belowThreshold).toBe(true); // 0% is below 75%

    // Overall summary should be 0/4
    expect(body.data.overall.attended).toBe(0);
    expect(body.data.overall.held).toBe(4);
    expect(body.data.overall.percentage).toBe(0);
  });
});
