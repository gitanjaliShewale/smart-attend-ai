/**
 * GET /api/attendance/session/[sessionId]/live — Fetch live attendance count and roster for session.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Teacher, AttendanceSession, AttendanceRecord, Student } from "@/models";
import { ApiResponse } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  if (session.user.role !== "teacher") {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "Only teachers can view live session attendance" } },
      { status: 403 }
    );
  }

  const { sessionId } = await params;
  if (!sessionId || !/^[0-9a-fA-F]{24}$/.test(sessionId)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INVALID_INPUT", message: "Invalid session ID format" } },
      { status: 400 }
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

  const qrSession = await AttendanceSession.findById(sessionId);
  if (!qrSession) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Attendance session not found" } },
      { status: 404 }
    );
  }

  // Verify class ownership
  if (qrSession.teacherId.toString() !== teacher._id.toString()) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "Access denied to this session" } },
      { status: 403 }
    );
  }

  // Find all attendance records logged for this session
  const records = await AttendanceRecord.find({ sessionId: qrSession._id })
    .sort({ serverTimestamp: -1 })
    .lean();

  const attendees: any[] = [];
  for (const rec of records) {
    const studentDoc = await Student.findById(rec.studentId).lean();
    attendees.push({
      studentId: rec.studentId.toString(),
      studentCode: studentDoc?.studentCode || "—",
      fullName: studentDoc?.fullName || "Unknown Student",
      timestamp: rec.serverTimestamp.toISOString(),
      verificationMethod: (rec as any).verificationMethod || "qr",
      faceMatchScore: (rec as any).faceMatchScore,
    });
  }

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      count: attendees.length,
      attendees,
    },
  });
}
