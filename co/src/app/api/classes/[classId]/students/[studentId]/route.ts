/**
 * DELETE /api/classes/[classId]/students/[studentId] — Drop a student from class roster (Teacher only).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Class, Teacher, Enrollment } from "@/models";
import { verifyOrigin } from "@/lib/auth/security";
import { ApiResponse } from "@/types";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; studentId: string }> }
): Promise<NextResponse> {
  const { classId, studentId } = await params;

  // Validate ID parameters formats to protect against query operator injection
  if (!/^[0-9a-fA-F]{24}$/.test(classId) || !/^[0-9a-fA-F]{24}$/.test(studentId)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INVALID_INPUT", message: "Invalid Class ID or Student ID format" } },
      { status: 400 }
    );
  }

  // Validate CSRF
  const originCheck = verifyOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: originCheck.error || "Cross-origin request rejected" } },
      { status: 403 }
    );
  }

  // Validate session & role
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

  // Validate class ownership
  const classDoc = await Class.findById(classId);
  if (!classDoc) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Class not found" } },
      { status: 404 }
    );
  }

  const teacher = await Teacher.findOne({ userId: session.user.id });
  if (!teacher || classDoc.teacherId.toString() !== teacher._id.toString()) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "You do not own this class" } },
      { status: 403 }
    );
  }

  // Look up enrollment
  const enrollment = await Enrollment.findOne({
    classId,
    studentId,
    status: "active",
  });

  if (!enrollment) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Active enrollment not found for this student in this class" } },
      { status: 404 }
    );
  }

  // Update status to dropped
  enrollment.status = "dropped";
  await enrollment.save();

  return NextResponse.json<ApiResponse>({
    success: true,
  });
}
