/**
 * Dev-only seed endpoint.
 * Seeds demo users, classes, subjects, enrollments, and settings
 * into the currently running (in-memory) MongoDB instance.
 *
 * PROTECTED: Only available when NODE_ENV !== "production"
 * POST /api/dev-seed
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb/connection";
import {
  User,
  Student,
  Teacher,
  Device,
  Class,
  Subject,
  Enrollment,
  Setting,
} from "@/models";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seed endpoint disabled in production." },
      { status: 403 }
    );
  }

  await connectToDatabase();

  // Clean existing data
  await Promise.all([
    User.deleteMany({}),
    Student.deleteMany({}),
    Teacher.deleteMany({}),
    Device.deleteMany({}),
    Class.deleteMany({}),
    Subject.deleteMany({}),
    Enrollment.deleteMany({}),
    Setting.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // Teachers
  const teacherUser1 = await User.create({
    email: "varsha.sahane@university.edu",
    passwordHash,
    role: "teacher",
    isActive: true,
  });
  const teacher1 = await Teacher.create({
    userId: teacherUser1._id,
    fullName: "Varsha Sahane",
  });

  const teacherUser2 = await User.create({
    email: "aashish.kale@university.edu",
    passwordHash,
    role: "teacher",
    isActive: true,
  });
  const teacher2 = await Teacher.create({
    userId: teacherUser2._id,
    fullName: "Aashish Kale",
  });

  const teacherUser3 = await User.create({
    email: "nilesh.sharma@university.edu",
    passwordHash,
    role: "teacher",
    isActive: true,
  });
  const teacher3 = await Teacher.create({
    userId: teacherUser3._id,
    fullName: "Nilesh Sharma",
  });

  // Students
  const studentUser1 = await User.create({
    email: "gitanjali.shewale@university.edu",
    passwordHash,
    role: "student",
    isActive: true,
  });
  const student1 = await Student.create({
    userId: studentUser1._id,
    studentCode: "STU1024",
    fullName: "Gitanjali Shewale",
  });

  const studentUser2 = await User.create({
    email: "sameer.tamboli@university.edu",
    passwordHash,
    role: "student",
    isActive: true,
  });
  const student2 = await Student.create({
    userId: studentUser2._id,
    studentCode: "STU1025",
    fullName: "Sameer Tamboli",
  });

  const studentUser3 = await User.create({
    email: "karan.nagare@university.edu",
    passwordHash,
    role: "student",
    isActive: true,
  });
  const student3 = await Student.create({
    userId: studentUser3._id,
    studentCode: "STU1026",
    fullName: "Karan Nagare",
  });

  const studentUser4 = await User.create({
    email: "vedant.deore@university.edu",
    passwordHash,
    role: "student",
    isActive: true,
  });
  const student4 = await Student.create({
    userId: studentUser4._id,
    studentCode: "STU1027",
    fullName: "Vedant Deore",
  });

  // Initial sample face descriptor vector for instant testing
  const sampleFaceVector = new Array(128).fill(0).map((_, i) => Math.sin(i * 0.15) * 0.5 + 0.5);

  student1.faceProfile = { isEnrolled: true, enrolledAt: new Date(), faceDescriptor: sampleFaceVector };
  student2.faceProfile = { isEnrolled: true, enrolledAt: new Date(), faceDescriptor: sampleFaceVector };
  student3.faceProfile = { isEnrolled: true, enrolledAt: new Date(), faceDescriptor: sampleFaceVector };
  student4.faceProfile = { isEnrolled: true, enrolledAt: new Date(), faceDescriptor: sampleFaceVector };

  await Promise.all([student1.save(), student2.save(), student3.save(), student4.save()]);

  // Fixed device UUIDs (valid RFC-4122 v4 format) — stored in DB and matched via localStorage
  const DEVICE_UUIDS = {
    gitanjali: "a1b2c3d4-e5f6-4a7b-8c9d-100000000001",
    sameer:    "a1b2c3d4-e5f6-4a7b-8c9d-100000000002",
    karan:     "a1b2c3d4-e5f6-4a7b-8c9d-100000000003",
    vedant:    "a1b2c3d4-e5f6-4a7b-8c9d-100000000004",
  };

  await Device.create({ studentId: student1._id, deviceUuid: DEVICE_UUIDS.gitanjali, status: "active", registeredAt: new Date(), lastSeenAt: new Date() });
  await Device.create({ studentId: student2._id, deviceUuid: DEVICE_UUIDS.sameer,    status: "active", registeredAt: new Date(), lastSeenAt: new Date() });
  await Device.create({ studentId: student3._id, deviceUuid: DEVICE_UUIDS.karan,     status: "active", registeredAt: new Date(), lastSeenAt: new Date() });
  await Device.create({ studentId: student4._id, deviceUuid: DEVICE_UUIDS.vedant,    status: "active", registeredAt: new Date(), lastSeenAt: new Date() });

  const class1 = await Class.create({
    name: "Distributed Systems (CS301)",
    teacherId: teacher1._id,
    academicTerm: "Fall 2026",
    isActive: true,
  });
  const class2 = await Class.create({
    name: "Database Internals (CS304)",
    teacherId: teacher2._id,
    academicTerm: "Fall 2026",
    isActive: true,
  });
  const class3 = await Class.create({
    name: "Operating Systems (CS302)",
    teacherId: teacher3._id,
    academicTerm: "Fall 2026",
    isActive: true,
  });

  // Subjects
  const subject1 = await Subject.create({
    name: "Raft Consensus & Log Replication",
    classId: class1._id,
  });
  const subject2 = await Subject.create({
    name: "B-Tree Storage Engines",
    classId: class2._id,
  });
  const subject3 = await Subject.create({
    name: "Process Scheduling & Memory Management",
    classId: class3._id,
  });

  // Enrollments — all students enrolled in all classes
  await Enrollment.create({ studentId: student1._id, classId: class1._id, status: "active" });
  await Enrollment.create({ studentId: student1._id, classId: class2._id, status: "active" });
  await Enrollment.create({ studentId: student1._id, classId: class3._id, status: "active" });
  await Enrollment.create({ studentId: student2._id, classId: class1._id, status: "active" });
  await Enrollment.create({ studentId: student2._id, classId: class2._id, status: "active" });
  await Enrollment.create({ studentId: student2._id, classId: class3._id, status: "active" });
  await Enrollment.create({ studentId: student3._id, classId: class1._id, status: "active" });
  await Enrollment.create({ studentId: student3._id, classId: class2._id, status: "active" });
  await Enrollment.create({ studentId: student3._id, classId: class3._id, status: "active" });
  await Enrollment.create({ studentId: student4._id, classId: class1._id, status: "active" });
  await Enrollment.create({ studentId: student4._id, classId: class2._id, status: "active" });
  await Enrollment.create({ studentId: student4._id, classId: class3._id, status: "active" });

  // Settings
  await Setting.create([
    { key: "qrExpirySeconds", value: 300 },
    { key: "qrRotationSeconds", value: 30 },
    { key: "attendanceThresholdPercent", value: 75 },
  ]);

  return NextResponse.json({
    success: true,
    message: "Database seeded successfully!",
    credentials: {
      teachers: [
        { email: "varsha.sahane@university.edu", password: "Password123!", name: "Varsha Sahane" },
        { email: "aashish.kale@university.edu", password: "Password123!", name: "Aashish Kale" },
        { email: "nilesh.sharma@university.edu", password: "Password123!", name: "Nilesh Sharma" },
      ],
      students: [
        { email: "gitanjali.shewale@university.edu", password: "Password123!", code: "STU1024", deviceUuid: DEVICE_UUIDS.gitanjali },
        { email: "sameer.tamboli@university.edu",    password: "Password123!", code: "STU1025", deviceUuid: DEVICE_UUIDS.sameer },
        { email: "karan.nagare@university.edu",      password: "Password123!", code: "STU1026", deviceUuid: DEVICE_UUIDS.karan },
        { email: "vedant.deore@university.edu",      password: "Password123!", code: "STU1027", deviceUuid: DEVICE_UUIDS.vedant },
      ],
    },
    setup: {
      instructions: "Paste the matching line in DevTools Console (F12) after logging in as that student:",
      browserConsoleSnippets: {
        gitanjali: `localStorage.setItem('attendqr_device_uuid', '${DEVICE_UUIDS.gitanjali}')`,
        sameer:    `localStorage.setItem('attendqr_device_uuid', '${DEVICE_UUIDS.sameer}')`,
        karan:     `localStorage.setItem('attendqr_device_uuid', '${DEVICE_UUIDS.karan}')`,
        vedant:    `localStorage.setItem('attendqr_device_uuid', '${DEVICE_UUIDS.vedant}')`,
      },
    },
    data: {
      classes: [
        { id: String(class1._id), name: class1.name },
        { id: String(class2._id), name: class2.name },
        { id: String(class3._id), name: class3.name },
      ],
      subjects: [
        { id: String(subject1._id), name: subject1.name },
        { id: String(subject2._id), name: subject2.name },
        { id: String(subject3._id), name: subject3.name },
      ],
    },
  });
}
