/**
 * GET /api/qr/active — Retrieve the current active session for the authenticated teacher, if any (Teacher only).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Teacher, AttendanceSession } from "@/models";
import QRCode from "qrcode";
import { ApiResponse } from "@/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
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

  await connectToDatabase();

  const teacher = await Teacher.findOne({ userId: session.user.id });
  if (!teacher) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Teacher record not found" } },
      { status: 404 }
    );
  }

  const now = new Date();

  // Find active session
  const qrSession = await AttendanceSession.findOne({
    teacherId: teacher._id,
    status: "active",
    expiresAt: { $gt: now },
  });

  if (!qrSession) {
    return NextResponse.json<ApiResponse>({
      success: true,
      data: null, // No active session
    });
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
  const scanUrl = `${request.nextUrl.origin}/attendance/scan?t=${qrSession.token}`;
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(scanUrl);
  } catch (err) {
    console.error("QR Code image generation failed:", err);
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
      classId: qrSession.classId.toString(),
      subjectId: qrSession.subjectId.toString(),
    },
  });
}
