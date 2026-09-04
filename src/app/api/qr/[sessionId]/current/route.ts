/**
 * GET /api/qr/[sessionId]/current — Get current session token, expiry, and server-side QR data URL (Teacher only).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Teacher, AttendanceSession } from "@/models";
import QRCode from "qrcode";
import { ApiResponse } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const { sessionId } = await params;

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

  if (!sessionId || !/^[0-9a-fA-F]{24}$/.test(sessionId)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INVALID_INPUT", message: "Invalid session ID format" } },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const qrSession = await AttendanceSession.findById(sessionId);
  if (!qrSession) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Attendance session not found" } },
      { status: 404 }
    );
  }

  // Verify ownership
  const teacher = await Teacher.findOne({ userId: session.user.id });
  if (!teacher || qrSession.teacherId.toString() !== teacher._id.toString()) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "You do not own this session" } },
      { status: 403 }
    );
  }

  const now = new Date();

  // If expired, update status
  if (qrSession.status === "active" && qrSession.expiresAt.getTime() <= now.getTime()) {
    qrSession.status = "expired";
    await qrSession.save();
  }

  if (qrSession.status !== "active") {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: "SESSION_INACTIVE",
          message: `The attendance session is not active (${qrSession.status})`,
        },
      },
      { status: 400 }
    );
  }

  // Read config settings
  const { getSettingValue } = await import("@/lib/settings");
  const qrRotationSeconds = await getSettingValue("qrRotationSeconds", 10);

  // Fetch Class and Subject details for display
  const [classDoc, subjectDoc] = await Promise.all([
    import("@/models").then(m => m.Class.findById(qrSession.classId).lean()),
    import("@/models").then(m => m.Subject.findById(qrSession.subjectId).lean())
  ]);

  // Generate server-side QR image containing only the scan URL
  // No student PII, no metadata
  const scanUrl = `${request.nextUrl.origin}/attendance/scan?t=${qrSession.token}`;
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(scanUrl);
  } catch (err) {
    console.error("QR Code image generation failed:", err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "QR_GENERATION_FAILED", message: "Failed to generate QR code image" } },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      sessionId: qrSession._id.toString(),
      token: qrSession.token,
      expiresAt: qrSession.expiresAt.toISOString(),
      qrDataUrl,
      qrRotationSeconds,
      className: classDoc?.name || "Unknown Class",
      subjectName: subjectDoc?.name || "Unknown Subject",
    },
  });
}
