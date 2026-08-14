/**
 * Phase 6 — Classes & Subjects API Tests
 *
 * Tests:
 *  - GET  /api/classes: teacher sees own classes; student sees enrolled classes only
 *  - POST /api/classes: teacher can create class; student cannot
 *  - GET  /api/classes/[classId]: correct tenant boundaries
 *  - POST /api/classes/[classId]/students: enroll by studentCode; duplicate guard
 *  - DELETE /api/classes/[classId]/students/[studentId]: drop student (teacher only)
 *  - GET/POST /api/subjects: access control and creation
 *  - Zod validation schema tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { User, Student, Teacher, Class, Subject, Enrollment } from "@/models";
import { createClassSchema, enrollStudentSchema } from "@/lib/validation/class.schema";
import { createSubjectSchema } from "@/lib/validation/subject.schema";
import type { Session } from "next-auth";

// ============================================================
// Mocks
// ============================================================
vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock("@/lib/mongodb/connection", () => ({ connectToDatabase: vi.fn().mockResolvedValue(undefined) }));

import { auth } from "@/lib/auth/auth";
import { GET as getClasses, POST as createClass } from "@/app/api/classes/route";
import { GET as getClassDetail } from "@/app/api/classes/[classId]/route";
import { POST as enrollStudent } from "@/app/api/classes/[classId]/students/route";
import { DELETE as dropStudent } from "@/app/api/classes/[classId]/students/[studentId]/route";
import { GET as getSubjects, POST as createSubject } from "@/app/api/subjects/route";

const authMock = vi.mocked(auth) as unknown as { mockResolvedValueOnce: (v: Session | null) => void };

// ============================================================
// DB Setup
// ============================================================
let mongod: MongoMemoryReplSet;
let teacherUserId: string;
let teacherMongoId: string;
let otherTeacherUserId: string;
let studentUserId: string;
let studentMongoId: string;
let classId: string;
let otherClassId: string;

beforeAll(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
  await Promise.all([User.init(), Student.init(), Teacher.init(), Class.init(), Subject.init(), Enrollment.init()]);

  const hash = await bcrypt.hash("Password123!", 10);

  const u1 = await User.create({ email: "t1@test.edu", passwordHash: hash, role: "teacher", isActive: true });
  const t1 = await Teacher.create({ userId: u1._id, fullName: "Prof. T1" });
  teacherUserId = u1._id.toString();
  teacherMongoId = t1._id.toString();

  const u2 = await User.create({ email: "t2@test.edu", passwordHash: hash, role: "teacher", isActive: true });
  const t2 = await Teacher.create({ userId: u2._id, fullName: "Prof. T2" });
  otherTeacherUserId = u2._id.toString();

  const u3 = await User.create({ email: "s1@test.edu", passwordHash: hash, role: "student", isActive: true });
  const s1 = await Student.create({ userId: u3._id, studentCode: "STU-9900", fullName: "Alice Doe" });
  studentUserId = u3._id.toString();
  studentMongoId = s1._id.toString();

  // Teacher T1 owns cls1
  const cls1 = await Class.create({ name: "CS-101", academicTerm: "Fall 2026", teacherId: t1._id, isActive: true });
  classId = cls1._id.toString();

  // Teacher T2 owns another class (not accessible by T1 or non-enrolled student)
  const cls2 = await Class.create({ name: "CS-999", academicTerm: "Fall 2026", teacherId: t2._id, isActive: true });
  otherClassId = cls2._id.toString();
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
    origin: parsedUrl.origin,  // e.g. "http://localhost:3000" — required for CSRF check
    host: parsedUrl.host,
  });
  return new NextRequest(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  } as ConstructorParameters<typeof NextRequest>[1]);
}

// ============================================================
// GET /api/classes
// ============================================================
describe("GET /api/classes", () => {
  it("returns 401 for unauthenticated request", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await getClasses();
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    expect(res.status).toBe(401);
  });

  it("teacher sees only own classes", async () => {
    authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
    const res = await getClasses();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.every((c: { id: string }) => c.id === classId)).toBe(true);
    expect(data.data.map((c: { id: string }) => c.id)).not.toContain(otherClassId);
  });

  it("student sees enrolled classes only", async () => {
    // First enroll the student
    await Enrollment.create({ classId, studentId: studentMongoId, status: "active", enrolledAt: new Date() });

    authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
    const res = await getClasses();
    const data = await res.json();
    expect(data.success).toBe(true);
    const ids = data.data.map((c: { id: string }) => c.id);
    expect(ids).toContain(classId);
    expect(ids).not.toContain(otherClassId);
  });
});

// ============================================================
// POST /api/classes
// ============================================================
describe("POST /api/classes", () => {
  it("returns 403 when a student tries to create a class", async () => {
    authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
    const req = makeRequest("POST", "http://localhost:3000/api/classes", { name: "Hack Class", academicTerm: "Fall 2026" });
    const res = await createClass(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 on invalid name (too short)", async () => {
    authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
    const req = makeRequest("POST", "http://localhost:3000/api/classes", { name: "X", academicTerm: "Fall 2026" });
    const res = await createClass(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
  });

  it("teacher can create a class successfully", async () => {
    authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
    const req = makeRequest("POST", "http://localhost:3000/api/classes", { name: "CS-200 Algorithms", academicTerm: "Spring 2027" });
    const res = await createClass(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe("CS-200 Algorithms");
  });
});

// ============================================================
// GET /api/classes/[classId]
// ============================================================
describe("GET /api/classes/[classId]", () => {
  it("returns 403 for teacher who does not own the class", async () => {
    authMock.mockResolvedValueOnce(mockSession(otherTeacherUserId, "t2@test.edu", "teacher"));
    const req = makeRequest("GET", `http://localhost:3000/api/classes/${classId}`);
    const res = await getClassDetail(req, { params: Promise.resolve({ classId }) });
    expect(res.status).toBe(403);
  });

  it("returns class detail to the owning teacher", async () => {
    authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
    const req = makeRequest("GET", `http://localhost:3000/api/classes/${classId}`);
    const res = await getClassDetail(req, { params: Promise.resolve({ classId }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.class.id).toBe(classId);
    expect(Array.isArray(data.data.subjects)).toBe(true);
    expect(Array.isArray(data.data.students)).toBe(true);
  });

  it("returns 400 for malformed class ID", async () => {
    authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
    const req = makeRequest("GET", "http://localhost:3000/api/classes/not-an-id");
    const res = await getClassDetail(req, { params: Promise.resolve({ classId: "not-an-id" }) });
    expect(res.status).toBe(400);
  });
});

// ============================================================
// POST /api/classes/[classId]/students (enroll)
// ============================================================
describe("POST /api/classes/[classId]/students", () => {
  it("returns 403 when student tries to enroll another student", async () => {
    // CSRF passes (origin matches host); role guard rejects
    authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
    const req = makeRequest("POST", `http://localhost:3000/api/classes/${classId}/students`, { studentCode: "STU-XXXX" });
    const res = await enrollStudent(req, { params: Promise.resolve({ classId }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

  it("returns 409 when student is already enrolled (active)", async () => {
    authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
    // Student STU-9900 is already enrolled (active) from earlier DB setup test
    const req = makeRequest("POST", `http://localhost:3000/api/classes/${classId}/students`, { studentCode: "STU-9900" });
    const res = await enrollStudent(req, { params: Promise.resolve({ classId }) });
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.error.code).toBe("ALREADY_ENROLLED");
  });
});

// ============================================================
// DELETE /api/classes/[classId]/students/[studentId]
// ============================================================
describe("DELETE /api/classes/[classId]/students/[studentId]", () => {
  it("returns 403 when student tries to drop another student", async () => {
    authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
    const req = makeRequest("DELETE", `http://localhost:3000/api/classes/${classId}/students/${studentMongoId}`);
    const res = await dropStudent(req, { params: Promise.resolve({ classId, studentId: studentMongoId }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

  it("teacher can drop an active enrolled student and mark them dropped", async () => {
    // Re-activate the enrollment first so DROP works
    await Enrollment.findOneAndUpdate(
      { classId, studentId: studentMongoId },
      { status: "active", enrolledAt: new Date() }
    );
    authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
    const req = makeRequest("DELETE", `http://localhost:3000/api/classes/${classId}/students/${studentMongoId}`);
    const res = await dropStudent(req, { params: Promise.resolve({ classId, studentId: studentMongoId }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    const enrollment = await Enrollment.findOne({ classId, studentId: studentMongoId });
    expect(enrollment?.status).toBe("dropped");
  });
});

// ============================================================
// GET/POST /api/subjects
// ============================================================
describe("GET /api/subjects", () => {
  it("returns 400 when classId query param is missing", async () => {
    authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
    const req = makeRequest("GET", "http://localhost:3000/api/subjects");
    const res = await getSubjects(req);
    expect(res.status).toBe(400);
  });

  it("teacher can list subjects for their class", async () => {
    // Create a subject first
    await Subject.create({ name: "Test Subject", classId });
    authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
    const req = makeRequest("GET", `http://localhost:3000/api/subjects?classId=${classId}`);
    const res = await getSubjects(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.some((s: { name: string }) => s.name === "Test Subject")).toBe(true);
  });
});

describe("POST /api/subjects", () => {
  it("returns 403 when student tries to create a subject", async () => {
    authMock.mockResolvedValueOnce(mockSession(studentUserId, "s1@test.edu", "student"));
    const req = makeRequest("POST", "http://localhost:3000/api/subjects", { name: "Hack Sub", classId });
    const res = await createSubject(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when teacher tries to create subject in a class they don't own", async () => {
    authMock.mockResolvedValueOnce(mockSession(otherTeacherUserId, "t2@test.edu", "teacher"));
    const req = makeRequest("POST", "http://localhost:3000/api/subjects", { name: "Rogue Sub", classId });
    const res = await createSubject(req);
    expect(res.status).toBe(403);
  });

  it("teacher can create a subject in their own class", async () => {
    authMock.mockResolvedValueOnce(mockSession(teacherUserId, "t1@test.edu", "teacher"));
    const req = makeRequest("POST", "http://localhost:3000/api/subjects", { name: "Distributed Algorithms", classId });
    const res = await createSubject(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.name).toBe("Distributed Algorithms");
  });
});

// ============================================================
// Zod Schema Tests
// ============================================================
describe("Zod Schema — createClassSchema", () => {
  it("accepts valid name and term", () => {
    expect(createClassSchema.safeParse({ name: "CS101", academicTerm: "Fall 2026" }).success).toBe(true);
  });
  it("rejects too-short name", () => {
    expect(createClassSchema.safeParse({ name: "A", academicTerm: "Fall 2026" }).success).toBe(false);
  });
  it("rejects missing academicTerm", () => {
    expect(createClassSchema.safeParse({ name: "Valid Name" }).success).toBe(false);
  });
});

describe("Zod Schema — enrollStudentSchema", () => {
  it("accepts valid student code and upcases it", () => {
    const r = enrollStudentSchema.safeParse({ studentCode: "stu-1234" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.studentCode).toBe("STU-1234");
  });
  it("rejects empty student code", () => {
    expect(enrollStudentSchema.safeParse({ studentCode: "" }).success).toBe(false);
  });
});

describe("Zod Schema — createSubjectSchema", () => {
  it("accepts valid name and classId", () => {
    expect(createSubjectSchema.safeParse({ name: "Algorithms", classId: "64f1a2b3c4d5e6f7a8b9c0d1" }).success).toBe(true);
  });
  it("rejects invalid classId format", () => {
    expect(createSubjectSchema.safeParse({ name: "Algorithms", classId: "not-valid" }).success).toBe(false);
  });
});
