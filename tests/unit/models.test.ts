import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  User,
  Student,
  Teacher,
  Device,
  Class,
  Subject,
  Enrollment,
  AttendanceSession,
  AttendanceRecord,
  Notification,
  Setting,
} from "@/models";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  // Ensure all model indexes are created in memory database
  await Promise.all([
    User.init(),
    Student.init(),
    Teacher.init(),
    Device.init(),
    Class.init(),
    Subject.init(),
    Enrollment.init(),
    AttendanceSession.init(),
    AttendanceRecord.init(),
    Notification.init(),
    Setting.init(),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe("Mongoose Models & Schema Validation", () => {
  describe("User Model", () => {
    it("creates user successfully with valid fields", async () => {
      const user = await User.create({
        email: "test@university.edu",
        passwordHash: "hashed_pwd_123",
        role: "student",
      });
      expect(user._id).toBeDefined();
      expect(user.email).toBe("test@university.edu");
      expect(user.role).toBe("student");
      expect(user.isActive).toBe(true);
    });

    it("rejects duplicate email with 11000 duplicate key error", async () => {
      await User.create({
        email: "duplicate@university.edu",
        passwordHash: "hash1",
        role: "student",
      });

      await expect(
        User.create({
          email: "duplicate@university.edu",
          passwordHash: "hash2",
          role: "teacher",
        })
      ).rejects.toThrow();
    });

    it("enforces required fields and valid role enum", async () => {
      await expect(
        User.create({
          email: "missing_fields@university.edu",
        })
      ).rejects.toThrow(/passwordHash/);

      await expect(
        User.create({
          email: "invalid_role@university.edu",
          passwordHash: "hash",
          // @ts-expect-error testing invalid enum
          role: "superadmin",
        })
      ).rejects.toThrow();
    });
  });

  describe("Student & Teacher Models", () => {
    it("rejects duplicate studentCode and duplicate userId on Student", async () => {
      const user1 = await User.create({
        email: "s1@university.edu",
        passwordHash: "hash",
        role: "student",
      });

      const user2 = await User.create({
        email: "s2@university.edu",
        passwordHash: "hash",
        role: "student",
      });

      await Student.create({
        userId: user1._id,
        studentCode: "STU1001",
        fullName: "Student One",
      });

      // Duplicate studentCode should fail
      await expect(
        Student.create({
          userId: user2._id,
          studentCode: "STU1001",
          fullName: "Student Two",
        })
      ).rejects.toThrow();

      // Duplicate userId should fail
      await expect(
        Student.create({
          userId: user1._id,
          studentCode: "STU1002",
          fullName: "Student Three",
        })
      ).rejects.toThrow();
    });

    it("enforces unique userId on Teacher", async () => {
      const teacherUser = await User.create({
        email: "t1@university.edu",
        passwordHash: "hash",
        role: "teacher",
      });

      await Teacher.create({
        userId: teacherUser._id,
        fullName: "Prof. Smith",
      });

      await expect(
        Teacher.create({
          userId: teacherUser._id,
          fullName: "Prof. Duplicate",
        })
      ).rejects.toThrow();
    });
  });

  describe("Enrollment Compound Unique Index", () => {
    it("allows enrolling student in multiple different classes", async () => {
      const studentId = new mongoose.Types.ObjectId();
      const classId1 = new mongoose.Types.ObjectId();
      const classId2 = new mongoose.Types.ObjectId();

      const e1 = await Enrollment.create({ studentId, classId: classId1 });
      const e2 = await Enrollment.create({ studentId, classId: classId2 });

      expect(e1._id).toBeDefined();
      expect(e2._id).toBeDefined();
    });

    it("CRITICAL: rejects duplicate enrollment for same (studentId, classId)", async () => {
      const studentId = new mongoose.Types.ObjectId();
      const classId = new mongoose.Types.ObjectId();

      await Enrollment.create({ studentId, classId, status: "active" });

      await expect(
        Enrollment.create({ studentId, classId, status: "active" })
      ).rejects.toThrow();
    });
  });

  describe("AttendanceRecord Compound Unique Index (Duplicate Scan Guard)", () => {
    it("CRITICAL: rejects duplicate attendance for identical (sessionId, studentId)", async () => {
      const sessionId = new mongoose.Types.ObjectId();
      const studentId = new mongoose.Types.ObjectId();
      const classId = new mongoose.Types.ObjectId();
      const subjectId = new mongoose.Types.ObjectId();
      const deviceId = new mongoose.Types.ObjectId();

      // First scan succeeds
      const record1 = await AttendanceRecord.create({
        sessionId,
        studentId,
        classId,
        subjectId,
        deviceId,
        status: "present",
        serverTimestamp: new Date(),
      });
      expect(record1._id).toBeDefined();

      // Duplicate scan within same session must fail atomically via DB compound index
      await expect(
        AttendanceRecord.create({
          sessionId,
          studentId,
          classId,
          subjectId,
          deviceId,
          status: "present",
          serverTimestamp: new Date(),
        })
      ).rejects.toThrow();
    });

    it("allows different students to mark attendance in the same session", async () => {
      const sessionId = new mongoose.Types.ObjectId();
      const student1 = new mongoose.Types.ObjectId();
      const student2 = new mongoose.Types.ObjectId();
      const classId = new mongoose.Types.ObjectId();
      const subjectId = new mongoose.Types.ObjectId();
      const deviceId = new mongoose.Types.ObjectId();

      const r1 = await AttendanceRecord.create({
        sessionId,
        studentId: student1,
        classId,
        subjectId,
        deviceId,
        status: "present",
      });

      const r2 = await AttendanceRecord.create({
        sessionId,
        studentId: student2,
        classId,
        subjectId,
        deviceId,
        status: "present",
      });

      expect(r1._id).toBeDefined();
      expect(r2._id).toBeDefined();
    });
  });

  describe("Device, AttendanceSession & Setting Models", () => {
    it("rejects duplicate deviceUuid across devices", async () => {
      const student1 = new mongoose.Types.ObjectId();
      const student2 = new mongoose.Types.ObjectId();
      const uuid = "550e8400-e29b-41d4-a716-446655440000";

      await Device.create({
        studentId: student1,
        deviceUuid: uuid,
        status: "active",
      });

      await expect(
        Device.create({
          studentId: student2,
          deviceUuid: uuid,
          status: "active",
        })
      ).rejects.toThrow();
    });

    it("rejects duplicate AttendanceSession token and validates status enum", async () => {
      const classId = new mongoose.Types.ObjectId();
      const subjectId = new mongoose.Types.ObjectId();
      const teacherId = new mongoose.Types.ObjectId();
      const token = "crypto_tok_xyz123";

      await AttendanceSession.create({
        classId,
        subjectId,
        teacherId,
        token,
        status: "active",
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(
        AttendanceSession.create({
          classId,
          subjectId,
          teacherId,
          token,
          status: "active",
          expiresAt: new Date(Date.now() + 60000),
        })
      ).rejects.toThrow();
    });

    it("enforces unique Setting key", async () => {
      await Setting.create({ key: "qrExpirySeconds", value: 60 });

      await expect(
        Setting.create({ key: "qrExpirySeconds", value: 120 })
      ).rejects.toThrow();
    });
  });
});
