/**
 * GET /api/students/face/status — Get Face ID enrollment status for authenticated student.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Student } from "@/models";
import { ApiResponse } from "@/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  if (session.user.role !== "student") {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "Access restricted to students" } },
      { status: 403 }
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

  const isEnrolled = !!student.faceProfile?.isEnrolled;

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      isEnrolled,
      enrolledAt: student.faceProfile?.enrolledAt?.toISOString() || null,
      studentCode: student.studentCode,
      fullName: student.fullName,
      hasPhoto: !!student.faceProfile?.referencePhotoUrl,
    },
  });
}
