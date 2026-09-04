import { test, expect } from "@playwright/test";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  User,
  Student,
  Teacher,
  Class,
  Subject,
  Enrollment,
  Device,
  AttendanceSession,
  AttendanceRecord,
  Setting,
} from "../../src/models";

test.describe("Anti-Cheat QR Attendance E2E Happy Path (Phase 17)", () => {
  test.beforeAll(async () => {
    // Connect to the same memory database started by the runner
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in environment");
    }
    await mongoose.connect(process.env.MONGODB_URI);
  });

  test.afterAll(async () => {
    await mongoose.disconnect();
  });

  test.beforeEach(async () => {
    // Reset collections before each test run
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }

    // Seed required default configurations
    await Setting.create([
      { key: "qrExpirySeconds", value: 60 },
      { key: "qrRotationSeconds", value: 10 },
      { key: "attendanceThresholdPercent", value: 75 },
    ]);

    // Seed test users
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("Password123!", salt);

    // 1. Create Teacher
    const teacherUser = await User.create({
      email: "robert.vance@university.edu",
      passwordHash,
      role: "teacher",
      isActive: true,
    });
    await Teacher.create({
      userId: teacherUser._id,
      fullName: "Dr. Robert Vance",
    });

    // 2. Create Student
    const studentUser = await User.create({
      email: "student.e2e@university.edu",
      passwordHash,
      role: "student",
      isActive: true,
    });
    await Student.create({
      userId: studentUser._id,
      studentCode: "STU-E2E",
      fullName: "E2E Student",
    });
  });

  test("runs teacher class-subject setup, student device-register, simulated QR scan, live update, and dashboard check", async ({ page, browser }) => {
    // --- STEP 1: TEACHER LOG IN ---
    console.log("=== STEP 1: Teacher login ===");
    await page.goto("/login");
    await page.fill('input[type="email"]', "robert.vance@university.edu");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');

    // Wait for teacher dashboard redirect
    await page.waitForURL("**/teacher/dashboard");
    await expect(page.locator("h2")).toContainText("Launch Attendance Session", { timeout: 10000 });

    // --- STEP 2: TEACHER CREATES CLASS ---
    console.log("=== STEP 2: Teacher creates class ===");
    await page.click('a[href="/classes"]');
    await page.waitForURL("**/classes");

    // Open create class modal
    await page.locator('button:has-text("Create Class")').first().click();
    await page.fill('input[placeholder="e.g. Distributed Systems"]', "E2E Class");
    await page.fill('input[placeholder="e.g. Fall 2026"]', "Fall 2026");
    await page.locator('div.bg-white button:has-text("Create Class")').click();

    // Verify card is added
    await expect(page.locator("h3")).toContainText("E2E Class", { timeout: 5000 });

    // --- STEP 3: TEACHER SETS UP SUBJECT AND ENROLLS STUDENT ---
    console.log("=== STEP 3: Teacher sets up subject and enrolls student ===");
    await page.click('button:has-text("Roster & Detail")');
    await page.waitForURL("**/classes/*");

    // Add Subject
    await page.fill('input[placeholder="Subject name (e.g. Raft Consensus)"]', "E2E Subject");
    await page.click('input[placeholder="Subject name (e.g. Raft Consensus)"] >> .. >> button');
    await expect(page.locator("span.font-medium:has-text('E2E Subject')")).toBeVisible({ timeout: 5000 });

    // Enroll Student
    await page.fill('input[placeholder="Student Code (e.g. STU-1001)"]', "STU-E2E");
    await page.click('input[placeholder="Student Code (e.g. STU-1001)"] >> .. >> button');
    await expect(page.locator("td:has-text('STU-E2E')")).toBeVisible({ timeout: 5000 });

    // --- STEP 4: TEACHER STARTS ATTENDANCE SESSION ---
    console.log("=== STEP 4: Teacher starts session ===");
    await page.goto("/teacher/dashboard");
    await page.waitForURL("**/teacher/dashboard");

    // Select options and start
    await page.selectOption('select:has-text("-- Choose Class --")', { label: "E2E Class (Fall 2026)" });
    await page.waitForTimeout(500); // Allow subjects dropdown to populate
    await page.selectOption('select:has-text("-- Choose Subject --")', { label: "E2E Subject" });
    await page.click('button:has-text("Start Attendance Session")');

    // Verify h2 changes and QR code renders
    await expect(page.locator("h2")).toContainText("Active Attendance Session", { timeout: 10000 });
    await expect(page.locator("img[alt='Attendance QR Code']")).toBeVisible({ timeout: 10000 });

    // --- STEP 5: STUDENT LOG IN & AUTO-DEVICE REGISTER ---
    console.log("=== STEP 5: Student login ===");
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();

    await studentPage.goto("/login");
    await studentPage.fill('input[type="email"]', "student.e2e@university.edu");
    await studentPage.fill('input[type="password"]', "Password123!");
    await studentPage.click('button[type="submit"]');

    await studentPage.waitForURL("**/dashboard");

    // Wait for auto-device registration text to display as Active
    await expect(studentPage.locator("span:has-text('Active')")).toBeVisible({ timeout: 10000 });

    // --- STEP 6: STUDENT SCANS (SIMULATED SCAN ATTENDANCE) ---
    console.log("=== STEP 6: Simulated scan marking ===");
    // Fetch active session token and client device uuid
    const activeSession = await AttendanceSession.findOne({ status: "active" });
    expect(activeSession).toBeDefined();
    const token = activeSession!.token;

    const deviceUuid = await studentPage.evaluate(() => localStorage.getItem("attendqr_device_uuid"));
    expect(deviceUuid).toBeDefined();

    // Call POST mark attendance endpoint
    const markResult = await studentPage.evaluate(async ({ t, dev }) => {
      const res = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t, deviceUuid: dev }),
      });
      return res.json();
    }, { t: token, dev: deviceUuid! });

    expect(markResult.success).toBe(true);

    // --- STEP 7: LIVE ROSTER AND DASHBOARD REFRESH VERIFICATIONS ---
    console.log("=== STEP 7: Verifications ===");
    // Verify Live Roster on Teacher page lists student
    await expect(page.locator("p:has-text('E2E Student')")).toBeVisible({ timeout: 10000 });

    // Reload student page and check overall attendance stats percentage updates to 100%
    await studentPage.reload();
    await expect(studentPage.locator("span:has-text('100%')").first()).toBeVisible({ timeout: 10000 });

    // Cleanup E2E Contexts
    await studentContext.close();
  });
});
