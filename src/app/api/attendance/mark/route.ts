/**
 * POST /api/attendance/mark — Record and validate student attendance scan token.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { verifyOrigin } from "@/lib/auth/security";
import { Student, Device, Enrollment, AttendanceSession, AttendanceRecord } from "@/models";
import { markAttendanceSchema } from "@/lib/validation";
import { isRateLimited } from "@/lib/rate-limit";
import { checkAndTriggerNotification } from "@/lib/notifications/lowAttendanceCheck";
import { ApiResponse } from "@/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // CSRF verification
  const originCheck = verifyOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: originCheck.error || "Cross-origin request rejected" } },
      { status: 403 }
    );
  }

  // 1. Authenticate student session
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  if (session.user.role !== "student") {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "Only students can mark attendance" } },
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

  // Parse and validate client input
  const parsed = markAttendanceSchema.safeParse(body);
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

  const { token, deviceUuid } = parsed.data;

  await connectToDatabase();

  // Find Student details
  const student = await Student.findOne({ userId: session.user.id });
  if (!student) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Attendance could not be recorded" } },
      { status: 404 }
    );
  }

  // 6. Apply rate limiting per studentId and per IP
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const ipKey = `ip_${ip}`;
  const studentKey = `student_${student._id.toString()}`;

  // IP limit: 5 requests per 10s, Student limit: 3 requests per 10s
  if (isRateLimited(ipKey, 5, 10000) || isRateLimited(studentKey, 3, 10000)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Attendance could not be recorded" } },
      { status: 429 }
    );
  }

  // 2. Look up the AttendanceSession by token
  const qrSession = await AttendanceSession.findOne({ token });
  if (!qrSession) {
    console.warn(`[SECURITY AUDIT] Attendance mark rejected: QR session token not found. studentId=${student._id}`);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INVALID_TOKEN", message: "Attendance could not be recorded" } },
      { status: 400 }
    );
  }

  // 3. Verify session status and expiration
  const now = new Date();
  if (qrSession.status !== "active" || qrSession.expiresAt.getTime() <= now.getTime()) {
    console.warn(`[SECURITY AUDIT] Attendance mark rejected: Session inactive/expired. sessionId=${qrSession._id} studentId=${student._id}`);
    // If active but expired in time, update status to "expired"
    if (qrSession.status === "active") {
      qrSession.status = "expired";
      await qrSession.save();
    }
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "SESSION_INACTIVE", message: "Attendance could not be recorded" } },
      { status: 400 }
    );
  }

  // 4. Verify the student has an active Enrollment in session.classId
  const enrollment = await Enrollment.findOne({
    classId: qrSession.classId,
    studentId: student._id,
    status: "active",
  });
  if (!enrollment) {
    console.warn(`[SECURITY AUDIT] Attendance mark rejected: Student not enrolled. classId=${qrSession.classId} studentId=${student._id}`);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_ENROLLED", message: "Attendance could not be recorded" } },
      { status: 403 }
    );
  }

  // 5. Verify the student has an active Device matching the submitted deviceUuid
  const activeDevice = await Device.findOne({
    studentId: student._id,
    status: "active",
  });
  if (!activeDevice || activeDevice.deviceUuid !== deviceUuid.toLowerCase().trim()) {
    console.warn(`[SECURITY AUDIT] Attendance mark rejected: Device mismatch/unregistered. activeDeviceId=${activeDevice?._id ?? "none"} studentId=${student._id}`);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "DEVICE_MISMATCH", message: "Attendance could not be recorded" } },
      { status: 403 }
    );
  }

  // 7. Insert AttendanceRecord atomically, relying on compound unique index for duplicate scanning guards
  try {
    const record = await AttendanceRecord.create({
      sessionId: qrSession._id,
      studentId: student._id,
      classId: qrSession.classId,
      subjectId: qrSession.subjectId,
      deviceId: activeDevice._id,
      serverTimestamp: new Date(),
      status: "present", // Always set present, ignoring any client inputs
    });

    // Check for low-attendance alert triggers
    await checkAndTriggerNotification(student._id, qrSession.subjectId);

    // 8. Return success with recorded serverTimestamp only (ignore client body status/timestamps)
    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        serverTimestamp: record.serverTimestamp.toISOString(),
      },
    });
  } catch (err: any) {
    // Catch compound unique duplicate key error (code 11000)
    if (err.code === 11000 || err.message?.includes("E11000")) {
      console.warn(`[SECURITY AUDIT] Attendance mark rejected: Duplicate check-in. sessionId=${qrSession._id} studentId=${student._id}`);
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: "ALREADY_MARKED",
            message: "Attendance has already been marked for this session",
          },
        },
        { status: 409 }
      );
    }

    console.error("[Attendance validation] Unhandled DB insert error:", err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Attendance could not be recorded" } },
      { status: 500 }
    );
  }
}
