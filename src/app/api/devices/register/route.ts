/**
 * POST /api/devices/register — Register a new active device for the authenticated student.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Student, Device } from "@/models";
import { registerDevice } from "@/lib/device";
import { registerDeviceSchema } from "@/lib/validation";
import { verifyOrigin } from "@/lib/auth/security";
import { ApiResponse } from "@/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const originCheck = verifyOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: originCheck.error || "Cross-origin request rejected" } },
      { status: 403 }
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  if (session.user.role !== "student") {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "Only students can register devices" } },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INVALID_JSON", message: "Malformed JSON in request body" } },
      { status: 400 }
    );
  }

  const parsed = registerDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message || "Validation failed",
          details: parsed.error.format(),
        },
      },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const student = await Student.findOne({ userId: session.user.id });
  if (!student) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Student record not found" } },
      { status: 404 }
    );
  }

  // Rate Limiting: Max 5 attempts per 60 seconds per IP/student
  const { isRateLimited } = await import("@/lib/rate-limit");
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const ipKey = `dev_reg_ip:${ip}`;
  const studentKey = `dev_reg_student:${student._id.toString()}`;
  if (isRateLimited(ipKey, 5, 60000) || isRateLimited(studentKey, 5, 60000)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many registration attempts. Please try again later." } },
      { status: 429 }
    );
  }

  // Check if this UUID is already registered by another student to ensure uniqueness
  const uuidLower = parsed.data.deviceUuid.toLowerCase().trim();
  const duplicateUuid = await Device.findOne({
    deviceUuid: uuidLower,
    status: "active",
    studentId: { $ne: student._id },
  });

  if (duplicateUuid) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "DEVICE_CONFLICT", message: "This device is already active for another student" } },
      { status: 409 }
    );
  }

  const device = await registerDevice(student._id, uuidLower);

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      id: device._id.toString(),
      deviceUuid: device.deviceUuid,
      status: device.status,
      registeredAt: device.registeredAt,
    },
  });
}
