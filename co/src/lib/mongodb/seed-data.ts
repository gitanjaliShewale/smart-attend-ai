/**
 * Shared database seed logic for development and testing.
 * Provides idempotent seeding of demo teachers, students, classes, and settings.
 */
import bcrypt from "bcryptjs";
import {
  User,
  Student,
  Teacher,
  Device,
  Class,
  Subject,
  Enrollment,
  Setting,
} from "../../models";

export const DEMO_DEVICE_UUIDS = {
  gitanjali: "a1b2c3d4-e5f6-4a7b-8c9d-100000000001",
  sameer: "a1b2c3d4-e5f6-4a7b-8c9d-100000000002",
  karan: "a1b2c3d4-e5f6-4a7b-8c9d-100000000003",
  vedant: "a1b2c3d4-e5f6-4a7b-8c9d-100000000004",
};

export const DEMO_USERS = {
  teachers: [
    { email: "varsha.sahane@university.edu", fullName: "Varsha Sahane" },
    { email: "aashish.kale@university.edu", fullName: "Aashish Kale" },
    { email: "nilesh.sharma@university.edu", fullName: "Nilesh Sharma" },
  ],
  students: [
    {
      email: "gitanjali.shewale@university.edu",
      fullName: "Gitanjali Shewale",
      studentCode: "STU1024",
      deviceUuid: DEMO_DEVICE_UUIDS.gitanjali,
    },
    {
      email: "sameer.tamboli@university.edu",
      fullName: "Sameer Tamboli",
      studentCode: "STU1025",
      deviceUuid: DEMO_DEVICE_UUIDS.sameer,
    },
    {
      email: "karan.nagare@university.edu",
      fullName: "Karan Nagare",
      studentCode: "STU1026",
      deviceUuid: DEMO_DEVICE_UUIDS.karan,
    },
    {
      email: "vedant.deore@university.edu",
      fullName: "Vedant Deore",
      studentCode: "STU1027",
      deviceUuid: DEMO_DEVICE_UUIDS.vedant,
    },
  ],
  defaultPassword: "Password123!",
};

export async function seedDatabase(cleanExisting = true) {
  if (cleanExisting) {
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
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(DEMO_USERS.defaultPassword, salt);

  // 1. Teachers
  const teacherDocs = [];
  for (const t of DEMO_USERS.teachers) {
    const userDoc = await User.create({
      email: t.email,
      passwordHash,
      role: "teacher",
      isActive: true,
    });
    const teacherDoc = await Teacher.create({
      userId: userDoc._id,
      fullName: t.fullName,
    });
    teacherDocs.push(teacherDoc);
  }

  // 2. Students
  const studentDocs = [];
  const sampleFaceVector = new Array(128)
    .fill(0)
    .map((_, i) => Math.sin(i * 0.15) * 0.5 + 0.5);

  for (const s of DEMO_USERS.students) {
    const userDoc = await User.create({
      email: s.email,
      passwordHash,
      role: "student",
      isActive: true,
    });
    const studentDoc = await Student.create({
      userId: userDoc._id,
      studentCode: s.studentCode,
      fullName: s.fullName,
      faceProfile: {
        isEnrolled: true,
        enrolledAt: new Date(),
        faceDescriptor: sampleFaceVector,
      },
    });
    studentDocs.push(studentDoc);

    // Register active device
    await Device.create({
      studentId: studentDoc._id,
      deviceUuid: s.deviceUuid,
      status: "active",
      registeredAt: new Date(),
      lastSeenAt: new Date(),
    });
  }

  // 3. Classes
  const class1 = await Class.create({
    name: "Distributed Systems (CS301)",
    teacherId: teacherDocs[0]._id,
    academicTerm: "Fall 2026",
    isActive: true,
  });

  const class2 = await Class.create({
    name: "Database Internals (CS304)",
    teacherId: teacherDocs[1]._id,
    academicTerm: "Fall 2026",
    isActive: true,
  });

  const class3 = await Class.create({
    name: "Operating Systems (CS302)",
    teacherId: teacherDocs[2]._id,
    academicTerm: "Fall 2026",
    isActive: true,
  });

  // 4. Subjects
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

  // 5. Enrollments (all students in all classes)
  for (const stu of studentDocs) {
    await Enrollment.create({
      studentId: stu._id,
      classId: class1._id,
      status: "active",
    });
    await Enrollment.create({
      studentId: stu._id,
      classId: class2._id,
      status: "active",
    });
    await Enrollment.create({
      studentId: stu._id,
      classId: class3._id,
      status: "active",
    });
  }

  // 6. Settings
  await Setting.create([
    { key: "qrExpirySeconds", value: 300 },
    { key: "qrRotationSeconds", value: 30 },
    { key: "attendanceThresholdPercent", value: 75 },
  ]);

  return {
    teachers: teacherDocs,
    students: studentDocs,
    classes: [class1, class2, class3],
    subjects: [subject1, subject2, subject3],
  };
}
