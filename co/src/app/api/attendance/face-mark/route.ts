/**
 * POST /api/attendance/face-mark — Record attendance via facial biometric recognition.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { verifyOrigin } from "@/lib/auth/security";
import { Student, Device, Enrollment, AttendanceSession, AttendanceRecord } from "@/models";
import { verifyFaceMatch, normalizeFaceDescriptor } from "@/lib/biometrics";
import { isRateLimited } from "@/lib/rate-limit";
import { checkAndTriggerNotification } from "@/lib/notifications/lowAttendanceCheck";
import { ApiResponse } from "@/types";
import { z } from "zod";

const faceMarkAttendanceSchema = z.object({
  token: z.string().min(1, "Session token is required"),
  deviceUuid: z.string().uuid("Invalid device UUID format"),
  liveFaceDescriptor: z.array(z.number()).min(16, "Live face descriptor is required"),
});

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
  const parsed = faceMarkAttendanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message || "Validation failed",
        },
      },
      { status: 400 }
    );
  }

  const { token, deviceUuid, liveFaceDescriptor } = parsed.data;

  await connectToDatabase();

  // Find Student details
  const student = await Student.findOne({ userId: session.user.id }).lean();
  if (!student) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Student record not found" } },
      { status: 404 }
    );
  }

  // Check if student has enrolled Face ID
  const faceProfile = (student as any).faceProfile;
  if (!faceProfile || !faceProfile.isEnrolled || !Array.isArray(faceProfile.faceDescriptor) || faceProfile.faceDescriptor.length === 0) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: "FACE_NOT_ENROLLED",
          message: "Face ID is not enrolled. Please set up your Face ID in Profile before using facial attendance.",
        },
      },
      { status: 400 }
    );
  }

  // Apply rate limiting per studentId and per IP
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const ipKey = `ip_${ip}`;
  const studentKey = `student_${student._id.toString()}`;

  if (isRateLimited(ipKey, 5, 10000) || isRateLimited(studentKey, 3, 10000)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many attempts. Please wait a few moments." } },
      { status: 429 }
    );
  }

  // 2. Look up the AttendanceSession by token
  const qrSession = await AttendanceSession.findOne({ token });
  if (!qrSession) {
    console.warn(`[BIOMETRIC AUDIT] Face mark rejected: QR session token not found. studentId=${student._id}`);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INVALID_TOKEN", message: "Session token is invalid or not found." } },
      { status: 400 }
    );
  }

  // 3. Verify session status and expiration
  const now = new Date();
  if (qrSession.status !== "active" || qrSession.expiresAt.getTime() <= now.getTime()) {
    console.warn(`[BIOMETRIC AUDIT] Face mark rejected: Session inactive/expired. sessionId=${qrSession._id} studentId=${student._id}`);
    if (qrSession.status === "active") {
      qrSession.status = "expired";
      await qrSession.save();
    }
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "SESSION_INACTIVE", message: "This attendance session has ended or expired." } },
      { status: 400 }
    );
  }

  // 4. Verify class enrollment
  const enrollment = await Enrollment.findOne({
    classId: qrSession.classId,
    studentId: student._id,
    status: "active",
  });
  if (!enrollment) {
    console.warn(`[BIOMETRIC AUDIT] Face mark rejected: Student not enrolled. classId=${qrSession.classId} studentId=${student._id}`);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_ENROLLED", message: "You are not enrolled in this course." } },
      { status: 403 }
    );
  }

  // 5. Verify device binding
  const activeDevice = await Device.findOne({
    studentId: student._id,
    status: "active",
  });
  if (!activeDevice || activeDevice.deviceUuid !== deviceUuid.toLowerCase().trim()) {
    console.warn(`[BIOMETRIC AUDIT] Face mark rejected: Device mismatch. studentId=${student._id}`);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "DEVICE_MISMATCH", message: "Device mismatch. This browser/device is not authorized for your account." } },
      { status: 403 }
    );
  }

  // 6. Perform Biometric Facial Verification
  const normalizedLive = normalizeFaceDescriptor(liveFaceDescriptor);
  const matchResult = verifyFaceMatch(faceProfile.faceDescriptor, normalizedLive, 0.60);

  if (!matchResult.isMatch) {
    console.warn(
      `[BIOMETRIC AUDIT] Face verification mismatch: studentId=${student._id}, confidence=${matchResult.confidence}%, distance=${matchResult.distance}`
    );
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: "FACE_MISMATCH",
          message: `Face verification failed (${matchResult.confidence}% confidence score). Please ensure good lighting and look directly into the camera.`,
          details: {
            confidence: matchResult.confidence,
            distance: matchResult.distance,
          },
        },
      },
      { status: 401 }
    );
  }

  console.log(
    `[BIOMETRIC AUDIT] Face verified successfully: studentId=${student._id}, confidence=${matchResult.confidence}%`
  );

  // 7. Insert AttendanceRecord
  try {
    const record = await AttendanceRecord.create({
      sessionId: qrSession._id,
      studentId: student._id,
      classId: qrSession.classId,
      subjectId: qrSession.subjectId,
      deviceId: activeDevice._id,
      serverTimestamp: new Date(),
      status: "present",
      verificationMethod: "face",
      faceMatchScore: matchResult.confidence,
    });

    // Check for low-attendance alert triggers
    await checkAndTriggerNotification(student._id, qrSession.subjectId);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        serverTimestamp: record.serverTimestamp.toISOString(),
        verificationMethod: "face",
        faceConfidence: matchResult.confidence,
      },
    });
  } catch (err: any) {
    if (err.code === 11000 || err.message?.includes("E11000")) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: {
            code: "ALREADY_MARKED",
            message: "Your attendance has already been recorded for this session.",
          },
        },
        { status: 409 }
      );
    }

    console.error("[Biometrics validation] DB insert error:", err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Attendance could not be recorded" } },
      { status: 500 }
    );
  }
}
