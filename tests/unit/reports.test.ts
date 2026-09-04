/**
 * Phase 15 — Attendance Reports Tests
 *
 * Tests:
 *  - Teacher can fetch report data for their own classes
 *  - Teacher cannot fetch or export report data for classes they do not own (returns 403)
 *  - CSV export contents match calculated attendance values from Phase 13calculations module
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Class, Subject, Enrollment, Student, Teacher, AttendanceSession, AttendanceRecord } from "@/models";
import { GET as getReportData } from "@/app/api/reports/class/[classId]/route";
import { GET as exportReportCSV } from "@/app/api/reports/class/[classId]/export/route";
import { calculateSubjectAttendance } from "@/lib/attendance/calculations";

// Mock next-auth auth()
const mockSession = {
  user: {
    id: "user-teacher-A",
    role: "teacher",
  },
};

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn().mockImplementation(async () => mockSession),
}));

let mongod: MongoMemoryReplSet;

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
  await Promise.all([
    Class.init(),
    Subject.init(),
    Enrollment.init(),
    Student.init(),
    Teacher.init(),
    AttendanceSession.init(),
    AttendanceRecord.init(),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe("Teacher Reports API Suite (Phase 15)", () => {
  it("enforces ownership permissions on reports endpoints and validates CSV correctness", async () => {
    // 1. Setup teachers
    const teacherA = await Teacher.create({
      userId: new mongoose.Types.ObjectId("6a7e3506d977fe67d0661a01"),
      fullName: "Teacher Alpha",
    });

    const teacherB = await Teacher.create({
      userId: new mongoose.Types.ObjectId("6a7e3506d977fe67d0661a02"),
      fullName: "Teacher Beta",
    });

    // 2. Setup classes and subjects
    const classA = await Class.create({
      name: "Class A",
      teacherId: teacherA._id,
      academicTerm: "Fall 2026",
      isActive: true,
    });

    const classB = await Class.create({
      name: "Class B",
      teacherId: teacherB._id,
      academicTerm: "Fall 2026",
      isActive: true,
    });

    const subjectA = await Subject.create({
      name: "Math 101",
      classId: classA._id,
    });

    // 3. Setup student enrolled in Class A
    const student = await Student.create({
      userId: new mongoose.Types.ObjectId(),
      studentCode: "STU-R1",
      fullName: "Student Report User",
    });

    const enrolledAt = new Date(Date.now() - 3600000);
    await Enrollment.create({
      studentId: student._id,
      classId: classA._id,
      status: "active",
      enrolledAt,
    });

    // 4. Create 3 sessions for subject A, student attends 2 of them (66.7%)
    const s1 = await AttendanceSession.create({
      classId: classA._id,
      subjectId: subjectA._id,
      teacherId: teacherA._id,
      token: "tok-1",
      status: "expired",
      startedAt: new Date(Date.now() - 1800000),
      expiresAt: new Date(Date.now() - 1740000),
    });

    const s2 = await AttendanceSession.create({
      classId: classA._id,
      subjectId: subjectA._id,
      teacherId: teacherA._id,
      token: "tok-2",
      status: "expired",
      startedAt: new Date(Date.now() - 1200000),
      expiresAt: new Date(Date.now() - 1140000),
    });

    const s3 = await AttendanceSession.create({
      classId: classA._id,
      subjectId: subjectA._id,
      teacherId: teacherA._id,
      token: "tok-3",
      status: "expired",
      startedAt: new Date(Date.now() - 600000),
      expiresAt: new Date(Date.now() - 540000),
    });

    const deviceId = new mongoose.Types.ObjectId();
    await AttendanceRecord.create({
      sessionId: s1._id,
      studentId: student._id,
      classId: classA._id,
      subjectId: subjectA._id,
      deviceId,
      status: "present",
    });

    await AttendanceRecord.create({
      sessionId: s2._id,
      studentId: student._id,
      classId: classA._id,
      subjectId: subjectA._id,
      deviceId,
      status: "present",
    });

    // --- CASE 1: Teacher A accesses their own Class A report ---
    // Mock session as Teacher A
    mockSession.user.id = "6a7e3506d977fe67d0661a01";
    let req = new NextRequest(`http://localhost/api/reports/class/${classA._id}`);
    let res = await getReportData(req, { params: Promise.resolve({ classId: classA._id.toString() }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.students[0].studentCode).toBe("STU-R1");
    expect(body.data.students[0].subjects[0].attended).toBe(2);
    expect(body.data.students[0].subjects[0].held).toBe(3);
    expect(body.data.students[0].subjects[0].percentage).toBe(66.7);

    // --- CASE 2: Teacher B attempts to access Class A report ---
    // Mock session as Teacher B
    mockSession.user.id = "6a7e3506d977fe67d0661a02";
    req = new NextRequest(`http://localhost/api/reports/class/${classA._id}`);
    res = await getReportData(req, { params: Promise.resolve({ classId: classA._id.toString() }) });
    expect(res.status).toBe(403); // Forbidden

    // --- CASE 3: Teacher A exports Class A report as CSV ---
    mockSession.user.id = "6a7e3506d977fe67d0661a01";
    req = new NextRequest(`http://localhost/api/reports/class/${classA._id}/export`);
    res = await exportReportCSV(req, { params: Promise.resolve({ classId: classA._id.toString() }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");

    const csvText = await res.text();
    const lines = csvText.split("\r\n").filter(Boolean);
    expect(lines.length).toBe(2); // Header + Student Row
    expect(lines[0]).toBe("Student Code,Student Name,Subject Name,Sessions Held,Sessions Attended,Attendance Rate (%)");
    expect(lines[1]).toBe("STU-R1,Student Report User,Math 101,3,2,66.7%");

    // --- CASE 4: Teacher B attempts to export Class A report as CSV ---
    mockSession.user.id = "6a7e3506d977fe67d0661a02";
    req = new NextRequest(`http://localhost/api/reports/class/${classA._id}/export`);
    res = await exportReportCSV(req, { params: Promise.resolve({ classId: classA._id.toString() }) });
    expect(res.status).toBe(403); // Forbidden
  });
});
