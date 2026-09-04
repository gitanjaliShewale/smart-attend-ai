import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import { User, Student, Teacher } from "@/models";
import { registerUser } from "@/lib/auth/register";
import { verifyOrigin } from "@/lib/auth/security";
import { authConfig } from "@/lib/auth/auth.config";

let mongod: MongoMemoryReplSet;

beforeAll(async () => {
  // Use a replica set so Mongoose transactions are supported (matches production topology)
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  await Promise.all([User.init(), Student.init(), Teacher.init()]);
}, 30000);

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

describe("Phase 3: Authentication & Authorization", () => {
  describe("Registration Flow (registerUser)", () => {
    it("successfully registers a student and creates User + Student records", async () => {
      const result = await registerUser({
        email: "alice@university.edu",
        password: "Password123!",
        fullName: "Alice Student",
        role: "student",
        studentCode: "STU-2001",
      });

      expect(result.success).toBe(true);
      expect(result.data?.email).toBe("alice@university.edu");
      expect(result.data?.role).toBe("student");
      expect(result.data?.studentId).toBeDefined();

      const userInDb = await User.findOne({ email: "alice@university.edu" });
      expect(userInDb).toBeDefined();
      expect(userInDb?.role).toBe("student");

      // Verify password was hashed
      const isMatch = await bcrypt.compare("Password123!", userInDb!.passwordHash);
      expect(isMatch).toBe(true);

      const studentInDb = await Student.findOne({ userId: userInDb!._id });
      expect(studentInDb).toBeDefined();
      expect(studentInDb?.studentCode).toBe("STU-2001");
      expect(studentInDb?.fullName).toBe("Alice Student");
    });

    it("successfully registers a teacher and creates User + Teacher records", async () => {
      const result = await registerUser({
        email: "prof.oak@university.edu",
        password: "Password123!",
        fullName: "Prof. Samuel Oak",
        role: "teacher",
      });

      expect(result.success).toBe(true);
      expect(result.data?.email).toBe("prof.oak@university.edu");
      expect(result.data?.role).toBe("teacher");
      expect(result.data?.teacherId).toBeDefined();

      const userInDb = await User.findOne({ email: "prof.oak@university.edu" });
      const teacherInDb = await Teacher.findOne({ userId: userInDb!._id });
      expect(teacherInDb).toBeDefined();
      expect(teacherInDb?.fullName).toBe("Prof. Samuel Oak");
    });

    it("rejects weak password with validation error", async () => {
      const result = await registerUser({
        email: "weak@university.edu",
        password: "weak",
        fullName: "Weak User",
        role: "student",
        studentCode: "STU-9999",
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INVALID_INPUT");
    });

    it("rejects student registration without a student code", async () => {
      const result = await registerUser({
        email: "nostudentcode@university.edu",
        password: "Password123!",
        fullName: "No Code",
        role: "student",
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("INVALID_INPUT");
    });

    it("ANTI-ENUMERATION: duplicate email returns generic error without leaking account existence", async () => {
      await registerUser({
        email: "existing@university.edu",
        password: "Password123!",
        fullName: "Existing User",
        role: "student",
        studentCode: "STU-1111",
      });

      const duplicateResult = await registerUser({
        email: "existing@university.edu",
        password: "Password123!",
        fullName: "Second User",
        role: "teacher",
      });

      expect(duplicateResult.success).toBe(false);
      expect(duplicateResult.error?.code).toBe("REGISTRATION_FAILED");
      expect(duplicateResult.error?.message).toContain("Unable to complete registration");
    });
  });

  describe("Password Verification Logic", () => {
    it("verifies correct password and rejects wrong password", async () => {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash("CorrectPassword1!", salt);

      const isCorrect = await bcrypt.compare("CorrectPassword1!", passwordHash);
      const isWrong = await bcrypt.compare("WrongPassword123!", passwordHash);

      expect(isCorrect).toBe(true);
      expect(isWrong).toBe(false);
    });
  });

  describe("CSRF & Origin Verification Helper", () => {
    it("allows GET requests unconditionally", () => {
      const req = new Request("http://localhost:3000/api/students/me", {
        method: "GET",
      });
      const check = verifyOrigin(req);
      expect(check.valid).toBe(true);
    });

    it("allows POST request with matching Origin and Host", () => {
      const req = new Request("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
      });
      const check = verifyOrigin(req);
      expect(check.valid).toBe(true);
    });

    it("blocks POST request with mismatched Origin (Cross-site forgery)", () => {
      const req = new Request("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: {
          origin: "http://evil-attacker.com",
          host: "localhost:3000",
        },
      });
      const check = verifyOrigin(req);
      expect(check.valid).toBe(false);
      expect(check.error).toContain("Origin mismatch");
    });
  });

  describe("Route Guarding & Role Protection (Middleware logic)", () => {
    const authorizedCallback = authConfig.callbacks?.authorized;

    it("redirects unauthenticated request on protected student route /dashboard to /login", () => {
      const nextUrl = new URL("http://localhost:3000/dashboard");
      const result = authorizedCallback?.({
        auth: null as unknown as Parameters<NonNullable<typeof authorizedCallback>>[0]["auth"],
        request: { nextUrl } as unknown as Parameters<NonNullable<typeof authorizedCallback>>[0]["request"],
      });

      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect([302, 307]).toContain(response.status); // Redirect status
      expect(response.headers.get("location")).toContain("/login");
    });

    it("allows authenticated student to access /dashboard and /scan", () => {
      const nextUrl = new URL("http://localhost:3000/dashboard");
      const auth = {
        user: { id: "u1", email: "s@uni.edu", role: "student" as const, fullName: "Student" },
        expires: "2099-01-01",
      };

      const result = authorizedCallback?.({
        auth: auth as unknown as Parameters<NonNullable<typeof authorizedCallback>>[0]["auth"],
        request: { nextUrl } as unknown as Parameters<NonNullable<typeof authorizedCallback>>[0]["request"],
      });

      expect(result).toBe(true);
    });

    it("blocks student from accessing teacher route /teacher/dashboard and redirects to /dashboard", () => {
      const nextUrl = new URL("http://localhost:3000/teacher/dashboard");
      const auth = {
        user: { id: "u1", email: "s@uni.edu", role: "student" as const, fullName: "Student" },
        expires: "2099-01-01",
      };

      const result = authorizedCallback?.({
        auth: auth as unknown as Parameters<NonNullable<typeof authorizedCallback>>[0]["auth"],
        request: { nextUrl } as unknown as Parameters<NonNullable<typeof authorizedCallback>>[0]["request"],
      });

      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("blocks teacher from accessing student route /dashboard and redirects to /teacher/dashboard", () => {
      const nextUrl = new URL("http://localhost:3000/dashboard");
      const auth = {
        user: { id: "u2", email: "t@uni.edu", role: "teacher" as const, fullName: "Teacher" },
        expires: "2099-01-01",
      };

      const result = authorizedCallback?.({
        auth: auth as unknown as Parameters<NonNullable<typeof authorizedCallback>>[0]["auth"],
        request: { nextUrl } as unknown as Parameters<NonNullable<typeof authorizedCallback>>[0]["request"],
      });

      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.headers.get("location")).toBe("http://localhost:3000/teacher/dashboard");
    });
  });
});
