/**
 * POST /api/qr/start — Start a new QR attendance session (Teacher only).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Class, Teacher, Subject, AttendanceSession } from "@/models";
import { getSettingValue } from "@/lib/settings";
import { verifyOrigin } from "@/lib/auth/security";
import { startQrSessionSchema } from "@/lib/validation";
import crypto from "crypto";
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

  if (session.user.role !== "teacher") {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "Access restricted to teachers" } },
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

  const parsed = startQrSessionSchema.safeParse(body);
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

  const { classId, subjectId } = parsed.data;

  await connectToDatabase();

  // Verify class exists
  const classDoc = await Class.findById(classId);
  if (!classDoc) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Class not found" } },
      { status: 404 }
    );
  }

  // Verify teacher owns the class
  const teacher = await Teacher.findOne({ userId: session.user.id });
  if (!teacher || classDoc.teacherId.toString() !== teacher._id.toString()) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "You are not assigned to this class" } },
      { status: 403 }
    );
  }

  // Verify subject exists and belongs to this class
  const subjectDoc = await Subject.findOne({ _id: subjectId, classId });
  if (!subjectDoc) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Subject not found in this class" } },
      { status: 404 }
    );
  }

  // Check if an active session already exists for this class + subject
  const now = new Date();
  const existingActive = await AttendanceSession.findOne({
    classId,
    subjectId,
    status: "active",
    expiresAt: { $gt: now },
  });

  if (existingActive) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: "ACTIVE_SESSION_EXISTS",
          message: "An active attendance session is already running for this subject",
        },
      },
      { status: 409 }
    );
  }

  // Read config settings
  const qrExpirySeconds = await getSettingValue("qrExpirySeconds", 60);
  const qrRotationSeconds = await getSettingValue("qrRotationSeconds", 10);

  const expiresAt = new Date(now.getTime() + qrExpirySeconds * 1000);
  const initialToken = crypto.randomBytes(32).toString("base64url");

  const newSession = await AttendanceSession.create({
    classId,
    subjectId,
    teacherId: teacher._id,
    token: initialToken,
    status: "active",
    startedAt: now,
    expiresAt,
  });

  // Generate initial server-side QR
  const scanUrl = `${request.nextUrl.origin}/attendance/scan?t=${initialToken}`;
  let qrDataUrl = "";
  try {
    const QRCode = await import("qrcode");
    qrDataUrl = await QRCode.toDataURL(scanUrl);
  } catch (err) {
    console.error("QR Code image generation failed on session start:", err);
  }

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      sessionId: newSession._id.toString(),
      status: newSession.status,
      expiresAt: newSession.expiresAt.toISOString(),
      qrRotationSeconds,
      qrDataUrl,
      token: initialToken,
    },
  });
}
