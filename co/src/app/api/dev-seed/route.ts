/**
 * Seed endpoint.
 * Seeds demo users, classes, subjects, enrollments, and settings
 * into the database (MongoDB Atlas or in-memory).
 *
 * Available in development, or in production if database is empty or with AUTH_SECRET auth.
 * POST /api/dev-seed or GET /api/dev-seed
 */
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { seedDatabase, DEMO_USERS, DEMO_DEVICE_UUIDS } from "@/lib/mongodb/seed-data";
import { User } from "@/models";

async function handleSeed(request?: NextRequest) {
  await connectToDatabase();

  const userCount = await User.countDocuments();
  const isDev = process.env.NODE_ENV !== "production";
  const authSecret = process.env.AUTH_SECRET;
  const providedSecret = request?.headers.get("x-seed-secret") || request?.nextUrl.searchParams.get("secret");

  // Allow in dev, or in production if DB has 0 users, or if correct secret is provided
  if (!isDev && userCount > 0 && (!authSecret || providedSecret !== authSecret)) {
    return NextResponse.json(
      {
        error: "Database is already initialized. To re-seed in production, provide your AUTH_SECRET as a query parameter (?secret=...) or header (x-seed-secret).",
      },
      { status: 403 }
    );
  }

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

export async function POST(request: NextRequest) {
  return handleSeed(request);
}

export async function GET(request: NextRequest) {
  return handleSeed(request);
}
