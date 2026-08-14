/**
 * POST /api/qr/rotate/[sessionId] — Re-issue a new dynamic token for the active session (Teacher only).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Teacher, AttendanceSession } from "@/models";
import { verifyOrigin } from "@/lib/auth/security";
import crypto from "crypto";
import { ApiResponse } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const { sessionId } = await params;

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

  // Check if stopped or expired
  if (qrSession.status !== "active") {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "SESSION_INACTIVE", message: `Session status is ${qrSession.status}` } },
      { status: 400 }
    );
  }

  if (qrSession.expiresAt.getTime() <= now.getTime()) {
    qrSession.status = "expired";
    await qrSession.save();
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "SESSION_EXPIRED", message: "The attendance session has expired" } },
      { status: 400 }
    );
  }

  // Generate new token
  const newToken = crypto.randomBytes(32).toString("base64url");
  qrSession.token = newToken;
  await qrSession.save();

  // Generate server-side QR image containing only the scan URL
  const scanUrl = `${request.nextUrl.origin}/attendance/scan?t=${newToken}`;
  let qrDataUrl = "";
  try {
    const QRCode = await import("qrcode");
    qrDataUrl = await QRCode.toDataURL(scanUrl);
  } catch (err) {
    console.error("QR Code image generation failed on rotation:", err);
  }

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      token: qrSession.token,
      expiresAt: qrSession.expiresAt.toISOString(),
      qrDataUrl,
    },
  });
}
