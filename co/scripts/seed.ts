/**
 * Development Database Seed Script.
 * WARNING: NEVER EXECUTE IN PRODUCTION ENVIRONMENTS.
 *
 * Usage: npx tsx scripts/seed.ts (or node/ts-node)
 */
import mongoose from "mongoose";
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
} from "../src/models";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/attendance_dev";

async function seed() {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ CRITICAL: Attempted to run seed script in production! Aborting.");
    process.exit(1);
  }

  console.log("🌱 [Seed] Connecting to MongoDB at:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  console.log("🧹 [Seed] Cleaning existing test collections...");
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

  console.log("👤 [Seed] Creating Demo Users...");
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash("Password123!", salt);

  // 1. Create Teachers
  const teacherUser1 = await User.create({
    email: "varsha.sahane@university.edu",
    passwordHash: defaultPasswordHash,
    role: "teacher",
    isActive: true,
  });
  const teacher1 = await Teacher.create({
    userId: teacherUser1._id,
    fullName: "Varsha Sahane",
  });

  const teacherUser2 = await User.create({
    email: "aashish.kale@university.edu",
    passwordHash: defaultPasswordHash,
    role: "teacher",
    isActive: true,
  });
  const teacher2 = await Teacher.create({
    userId: teacherUser2._id,
    fullName: "Aashish Kale",
  });

  const teacherUser3 = await User.create({
    email: "nilesh.sharma@university.edu",
    passwordHash: defaultPasswordHash,
    role: "teacher",
    isActive: true,
  });
  const teacher3 = await Teacher.create({
    userId: teacherUser3._id,
    fullName: "Nilesh Sharma",
  });

  // 2. Create Students
  const studentUser1 = await User.create({
    email: "gitanjali.shewale@university.edu",
    passwordHash: defaultPasswordHash,
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
    passwordHash: defaultPasswordHash,
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
    passwordHash: defaultPasswordHash,
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
    passwordHash: defaultPasswordHash,
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

  // 3. Register Devices for Students
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

  // 4. Create Classes
  console.log("📚 [Seed] Creating Classes and Subjects...");
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

  // 5. Create Subjects
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

  // 6. Create Enrollments — all students in all classes
  console.log("📝 [Seed] Enrolling students in classes...");
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

  // 7. Seed Settings
  console.log("⚙️ [Seed] Seeding System Settings...");
  await Setting.create([
    { key: "qrExpirySeconds", value: 300 },
    { key: "qrRotationSeconds", value: 30 },
    { key: "attendanceThresholdPercent", value: 75 },
  ]);

  console.log("✅ [Seed] Database seeded successfully!");
  console.log("------------------------------------------");
  console.log("Teachers: varsha.sahane, aashish.kale, nilesh.sharma @university.edu");
  console.log("Students: gitanjali.shewale, sameer.tamboli, karan.nagare, vedant.deore @university.edu");
  console.log("Password for all: Password123!");
  console.log("------------------------------------------");
}

export { seed };

// Execute only if called directly
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
