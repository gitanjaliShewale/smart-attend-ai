/**
 * Phase 14 — Low-Attendance Notifications Tests
 *
 * Tests:
 *  - Notification created when crossing threshold
 *  - Spam prevention (not created again immediately after)
 *  - Created again after percentage drops by >= 5 points
 *  - Created again after cooldown period passes (>= 7 days)
 *  - Concurrent trigger attempts result in exactly one notification (concurrency safety)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Class, Subject, Enrollment, Student, AttendanceSession, AttendanceRecord, Notification, NotificationCooldown } from "@/models";
import { checkAndTriggerNotification } from "@/lib/notifications/lowAttendanceCheck";
import { calculateSubjectAttendance } from "@/lib/attendance/calculations";
import { clearSettingsCache } from "@/lib/settings";

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
    Notification.init(),
    NotificationCooldown.init(),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe("Low Attendance Notification System Suite (Phase 14)", () => {
  it("triggers notification on crossing threshold, prevents immediate duplicate spam, and triggers again on drop/expiry", async () => {
    const classId = new mongoose.Types.ObjectId();
    const subjectId = await createSubject("Course A", classId);
    const studentId = await createStudent("STU-N1", "Notification User 1");

    // Student enrolled 2 hours ago
    const enrolledAt = new Date(Date.now() - 7200000);
    await Enrollment.create({ studentId, classId, status: "active", enrolledAt });

    // 1. Initial State: Create 4 sessions, student attends 2 (50% - below 75% threshold)
    const s1 = await createSession(classId, subjectId, new Date(Date.now() - 3600000));
    const s2 = await createSession(classId, subjectId, new Date(Date.now() - 3000000));
    const s3 = await createSession(classId, subjectId, new Date(Date.now() - 2400000));
    const s4 = await createSession(classId, subjectId, new Date(Date.now() - 1800000));

    const deviceId = new mongoose.Types.ObjectId();
    await createRecord(s1._id, studentId, classId, subjectId, deviceId);
    await createRecord(s2._id, studentId, classId, subjectId, deviceId);

    // Trigger check
    const notified1 = await checkAndTriggerNotification(studentId, subjectId);
    expect(notified1).toBe(true);

    // Verify Notification document created
    const notices1 = await Notification.find({ studentId, subjectId });
    expect(notices1.length).toBe(1);
    expect(notices1[0].attendancePercentAtSend).toBe(50);
    expect(notices1[0].isRead).toBe(false);

    // Verify Cooldown document matches
    const cd1 = await NotificationCooldown.findOne({ studentId, subjectId });
    expect(cd1).not.toBeNull();
    expect(cd1?.lastNotifiedPercent).toBe(50);

    // 2. Spam Prevention: Call immediately again
    const notified2 = await checkAndTriggerNotification(studentId, subjectId);
    expect(notified2).toBe(false);

    // Total notices should still be 1
    const notices2 = await Notification.find({ studentId, subjectId });
    expect(notices2.length).toBe(1);

    // 3. Drop trigger: Create another session that student misses, rate drops to 40% (50 - 40 = 10 drop, which is >= 5)
    const s5 = await createSession(classId, subjectId, new Date(Date.now() - 600000));
    const notified3 = await checkAndTriggerNotification(studentId, subjectId);
    expect(notified3).toBe(true);

    // Verify a second notification was recorded
    const notices3 = await Notification.find({ studentId, subjectId }).sort({ sentAt: 1 });
    expect(notices3.length).toBe(2);
    expect(notices3[1].attendancePercentAtSend).toBe(40);

    // Verify updated cooldown
    const cd2 = await NotificationCooldown.findOne({ studentId, subjectId });
    expect(cd2?.lastNotifiedPercent).toBe(40);

    // 4. Cooldown Expiry trigger: Reset cooldown timestamp to 8 days ago, rate remains 40%
    await NotificationCooldown.updateOne(
      { studentId, subjectId },
      { $set: { lastNotifiedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } }
    );

    const notified4 = await checkAndTriggerNotification(studentId, subjectId);
    expect(notified4).toBe(true);

    // Verify third notification is created
    const notices4 = await Notification.find({ studentId, subjectId });
    expect(notices4.length).toBe(3);
  });

  it("handles concurrent checkAndTriggerNotification calls gracefully, creating exactly one notification", async () => {
    const classId = new mongoose.Types.ObjectId();
    const subjectId = await createSubject("Course B", classId);
    const studentId = await createStudent("STU-CONC", "Concurrent User");

    const enrolledAt = new Date(Date.now() - 7200000);
    await Enrollment.create({ studentId, classId, status: "active", enrolledAt });

    const s1 = await createSession(classId, subjectId, new Date(Date.now() - 3600000));
    const s2 = await createSession(classId, subjectId, new Date(Date.now() - 3000000));
    const s3 = await createSession(classId, subjectId, new Date(Date.now() - 2400000));
    const s4 = await createSession(classId, subjectId, new Date(Date.now() - 1800000));

    const deviceId = new mongoose.Types.ObjectId();
    await createRecord(s1._id, studentId, classId, subjectId, deviceId);
    await createRecord(s2._id, studentId, classId, subjectId, deviceId);

    // Concurrently trigger check
    const results = await Promise.all([
      checkAndTriggerNotification(studentId, subjectId),
      checkAndTriggerNotification(studentId, subjectId),
      checkAndTriggerNotification(studentId, subjectId),
    ]);

    // Exactly one call should have successfully triggered it
    const successCount = results.filter(Boolean).length;
    expect(successCount).toBe(1);

    // Verify exactly 1 Notification is present in database
    const notices = await Notification.find({ studentId, subjectId });
    expect(notices.length).toBe(1);

    // Verify exactly 1 Cooldown is present in database
    const cooldowns = await NotificationCooldown.find({ studentId, subjectId });
    expect(cooldowns.length).toBe(1);
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
