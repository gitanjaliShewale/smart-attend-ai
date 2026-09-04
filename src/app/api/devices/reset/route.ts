/**
 * POST /api/devices/reset — Revoke current active device registration requiring password validation.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Student, User } from "@/models";
import { revokeActiveDevice } from "@/lib/device";
import { resetDeviceSchema } from "@/lib/validation";
import { verifyOrigin } from "@/lib/auth/security";
import bcrypt from "bcryptjs";
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
      { success: false, error: { code: "FORBIDDEN", message: "Only students can reset device registration" } },
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

  const parsed = resetDeviceSchema.safeParse(body);
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

  const user = await User.findById(session.user.id);
  if (!user) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "User account not found" } },
      { status: 404 }
    );
  }

  // Verify credentials
  const isMatch = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!isMatch) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "UNAUTHORIZED", message: "Incorrect password" } },
      { status: 401 }
    );
  }

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
  const ipKey = `dev_reset_ip:${ip}`;
  const studentKey = `dev_reset_student:${student._id.toString()}`;
  if (isRateLimited(ipKey, 5, 60000) || isRateLimited(studentKey, 5, 60000)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many device reset attempts. Please try again later." } },
      { status: 429 }
    );
  }

  // Revoke device
  await revokeActiveDevice(student._id);

  return NextResponse.json<ApiResponse>({
    success: true,
  });
}
