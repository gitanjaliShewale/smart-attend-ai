/**
 * Dev-only seed endpoint.
 * Seeds demo users, classes, subjects, enrollments, and settings
 * into the currently running MongoDB instance.
 *
 * PROTECTED: Only available when NODE_ENV !== "production"
 * POST /api/dev-seed
 */
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { seedDatabase, DEMO_USERS, DEMO_DEVICE_UUIDS } from "@/lib/mongodb/seed-data";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seed endpoint disabled in production." },
      { status: 403 }
    );
  }

  await connectToDatabase();
  const seedResult = await seedDatabase(true);

  return NextResponse.json({
    success: true,
    message: "Database seeded successfully!",
    credentials: {
      teachers: DEMO_USERS.teachers.map((t) => ({
        email: t.email,
        password: DEMO_USERS.defaultPassword,
        name: t.fullName,
      })),
      students: DEMO_USERS.students.map((s) => ({
        email: s.email,
        password: DEMO_USERS.defaultPassword,
        code: s.studentCode,
        deviceUuid: s.deviceUuid,
      })),
    },
    setup: {
      instructions: "Paste the matching line in DevTools Console (F12) after logging in as that student:",
      browserConsoleSnippets: {
        gitanjali: `localStorage.setItem('attendqr_device_uuid', '${DEMO_DEVICE_UUIDS.gitanjali}')`,
        sameer: `localStorage.setItem('attendqr_device_uuid', '${DEMO_DEVICE_UUIDS.sameer}')`,
        karan: `localStorage.setItem('attendqr_device_uuid', '${DEMO_DEVICE_UUIDS.karan}')`,
        vedant: `localStorage.setItem('attendqr_device_uuid', '${DEMO_DEVICE_UUIDS.vedant}')`,
      },
    },
    data: {
      classes: seedResult.classes.map((c) => ({ id: String(c._id), name: c.name })),
      subjects: seedResult.subjects.map((s) => ({ id: String(s._id), name: s.name })),
    },
  });
}
