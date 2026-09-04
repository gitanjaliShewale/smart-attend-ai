/**
 * Phase 13 — Attendance Calculation Helper Tests
 *
 * Tests:
 *  - 100% attendance rate
 *  - Exactly at threshold (75%)
 *  - Below threshold (50%)
 *  - Zero sessions held (no NaN/Infinity, returns 0% + noDataYet: true)
 *  - Student enrolled mid-term (excludes sessions held prior to enrollment date)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Class, Subject, Enrollment, Student, AttendanceSession, AttendanceRecord } from "@/models";
import { calculateSubjectAttendance, calculateOverallAttendance } from "@/lib/attendance/calculations";

let mongod: MongoMemoryReplSet;

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
  await Promise.all([
    Class.init(),
    Subject.init(),
    Enrollment.init(),
    Student.init(),
    AttendanceSession.init(),
    AttendanceRecord.init(),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe("Attendance Calculation Helper Suite (Phase 13)", () => {
  it("calculates 100% attendance rate correctly", async () => {
    const classId = new mongoose.Types.ObjectId();
    const subjectId = await createSubject("Subject 100", classId);
    const studentId = await createStudent("STU-100", "One Hundred");

    // Enrolled 1 hour ago
    const enrolledAt = new Date(Date.now() - 3600000);
    await Enrollment.create({ studentId, classId, status: "active", enrolledAt });

    // Create 3 sessions
    const s1 = await createSession(classId, subjectId, new Date(Date.now() - 1800000));
    const s2 = await createSession(classId, subjectId, new Date(Date.now() - 1200000));
    const s3 = await createSession(classId, subjectId, new Date(Date.now() - 600000));

    // Attended all 3
    const deviceId = new mongoose.Types.ObjectId();
    await createRecord(s1._id, studentId, classId, subjectId, deviceId);
    await createRecord(s2._id, studentId, classId, subjectId, deviceId);
    await createRecord(s3._id, studentId, classId, subjectId, deviceId);

    const stats = await calculateSubjectAttendance(studentId, subjectId);
    expect(stats.held).toBe(3);
    expect(stats.attended).toBe(3);
    expect(stats.percentage).toBe(100);
    expect(stats.noDataYet).toBe(false);
  });

  it("calculates exactly 75% rate correctly", async () => {
    const classId = new mongoose.Types.ObjectId();
    const subjectId = await createSubject("Subject 75", classId);
    const studentId = await createStudent("STU-075", "Seventy Five");

    const enrolledAt = new Date(Date.now() - 3600000);
    await Enrollment.create({ studentId, classId, status: "active", enrolledAt });

    // 4 sessions
    const s1 = await createSession(classId, subjectId, new Date(Date.now() - 2000000));
    const s2 = await createSession(classId, subjectId, new Date(Date.now() - 1500000));
    const s3 = await createSession(classId, subjectId, new Date(Date.now() - 1000000));
    const s4 = await createSession(classId, subjectId, new Date(Date.now() - 500000));

    // Attended 3 out of 4
    const deviceId = new mongoose.Types.ObjectId();
    await createRecord(s1._id, studentId, classId, subjectId, deviceId);
    await createRecord(s2._id, studentId, classId, subjectId, deviceId);
    await createRecord(s3._id, studentId, classId, subjectId, deviceId);

    const stats = await calculateSubjectAttendance(studentId, subjectId);
    expect(stats.held).toBe(4);
    expect(stats.attended).toBe(3);
    expect(stats.percentage).toBe(75);
    expect(stats.noDataYet).toBe(false);
  });

  it("calculates below threshold rate (50%) correctly", async () => {
    const classId = new mongoose.Types.ObjectId();
    const subjectId = await createSubject("Subject 50", classId);
    const studentId = await createStudent("STU-050", "Fifty Percent");

    const enrolledAt = new Date(Date.now() - 3600000);
    await Enrollment.create({ studentId, classId, status: "active", enrolledAt });

    // 4 sessions
    const s1 = await createSession(classId, subjectId, new Date(Date.now() - 2000000));
    const s2 = await createSession(classId, subjectId, new Date(Date.now() - 1500000));
    const s3 = await createSession(classId, subjectId, new Date(Date.now() - 1000000));
    const s4 = await createSession(classId, subjectId, new Date(Date.now() - 500000));

    // Attended 2 out of 4
    const deviceId = new mongoose.Types.ObjectId();
    await createRecord(s1._id, studentId, classId, subjectId, deviceId);
    await createRecord(s2._id, studentId, classId, subjectId, deviceId);

    const stats = await calculateSubjectAttendance(studentId, subjectId);
    expect(stats.held).toBe(4);
    expect(stats.attended).toBe(2);
    expect(stats.percentage).toBe(50);
    expect(stats.noDataYet).toBe(false);
  });

  it("handles zero sessions held gracefully (no NaN, returns noDataYet: true)", async () => {
    const classId = new mongoose.Types.ObjectId();
    const subjectId = await createSubject("Subject Zero", classId);
    const studentId = await createStudent("STU-000", "Zero Held");

    const enrolledAt = new Date(Date.now() - 3600000);
    await Enrollment.create({ studentId, classId, status: "active", enrolledAt });

    // No sessions created

    const stats = await calculateSubjectAttendance(studentId, subjectId);
    expect(stats.held).toBe(0);
    expect(stats.attended).toBe(0);
    expect(stats.percentage).toBe(0);
    expect(stats.noDataYet).toBe(true);
  });

  it("excludes sessions held prior to student's enrollment date (mid-term enrollment)", async () => {
    const classId = new mongoose.Types.ObjectId();
    const subjectId = await createSubject("Subject Mid", classId);
    const studentId = await createStudent("STU-MID", "Enrolled Mid Term");

    // Session A created at T - 2 hours
    const sA = await createSession(classId, subjectId, new Date(Date.now() - 7200000));

    // Student enrolls at T - 1 hour
    const enrolledAt = new Date(Date.now() - 3600000);
    await Enrollment.create({ studentId, classId, status: "active", enrolledAt });

    // Session B created at T - 30 minutes
    const sB = await createSession(classId, subjectId, new Date(Date.now() - 180000));

    // Student attends Session B only
    const deviceId = new mongoose.Types.ObjectId();
    await createRecord(sB._id, studentId, classId, subjectId, deviceId);

    const stats = await calculateSubjectAttendance(studentId, subjectId);
    // Session A should be completely excluded from calculations
    expect(stats.held).toBe(1);
    expect(stats.attended).toBe(1);
    expect(stats.percentage).toBe(100);
    expect(stats.noDataYet).toBe(false);
  });

  it("calculates overall aggregate statistics correctly across multiple enrolled subjects", async () => {
    const classId = new mongoose.Types.ObjectId();
    const subA = await createSubject("Subject A", classId);
    const subB = await createSubject("Subject B", classId);
    const studentId = await createStudent("STU-ALL", "Multiple Courses");

    const enrolledAt = new Date(Date.now() - 3600000);
    await Enrollment.create({ studentId, classId, status: "active", enrolledAt });

    // Subject A: 2 sessions held, student attends 1
    const sA1 = await createSession(classId, subA, new Date(Date.now() - 2000000));
    const sA2 = await createSession(classId, subA, new Date(Date.now() - 1000000));
    await createRecord(sA1._id, studentId, classId, subA, new mongoose.Types.ObjectId());

    // Subject B: 2 sessions held, student attends 2
    const sB1 = await createSession(classId, subB, new Date(Date.now() - 2000000));
    const sB2 = await createSession(classId, subB, new Date(Date.now() - 1000000));
    await createRecord(sB1._id, studentId, classId, subB, new mongoose.Types.ObjectId());
    await createRecord(sB2._id, studentId, classId, subB, new mongoose.Types.ObjectId());

    const overall = await calculateOverallAttendance(studentId);
    // Overall: 3 attended out of 4 held = 75%
    expect(overall.held).toBe(4);
    expect(overall.attended).toBe(3);
    expect(overall.percentage).toBe(75);
    expect(overall.noDataYet).toBe(false);
  });
});

// ============================================================
// Helper Builders
// ============================================================
async function createSubject(name: string, classId: mongoose.Types.ObjectId) {
  const sub = await Subject.create({ name, classId });
  return sub._id;
}

async function createStudent(studentCode: string, fullName: string) {
  const user = await Student.create({
    userId: new mongoose.Types.ObjectId(),
    studentCode,
    fullName,
  });
  return user._id;
}

async function createSession(
  classId: mongoose.Types.ObjectId,
  subjectId: mongoose.Types.ObjectId,
  startedAt: Date
) {
  return await AttendanceSession.create({
    classId,
    subjectId,
    teacherId: new mongoose.Types.ObjectId(),
    token: `token-${Math.random()}`,
    status: "expired",
    startedAt,
    expiresAt: new Date(startedAt.getTime() + 60000),
  });
}

async function createRecord(
  sessionId: mongoose.Types.ObjectId,
  studentId: mongoose.Types.ObjectId,
  classId: mongoose.Types.ObjectId,
  subjectId: mongoose.Types.ObjectId,
  deviceId: mongoose.Types.ObjectId
) {
  return await AttendanceRecord.create({
    sessionId,
    studentId,
    classId,
    subjectId,
    deviceId,
    status: "present",
    serverTimestamp: new Date(),
  });
}
