/**
 * POST /api/classes/[classId]/students — Enroll a student in a class by studentCode (Teacher only).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Class, Teacher, Student, Enrollment } from "@/models";
import { enrollStudentSchema } from "@/lib/validation/class.schema";
import { verifyOrigin } from "@/lib/auth/security";
import { ApiResponse } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
): Promise<NextResponse> {
  const { classId } = await params;

  if (!/^[0-9a-fA-F]{24}$/.test(classId)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INVALID_INPUT", message: "Invalid Class ID format" } },
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

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INVALID_JSON", message: "Malformed JSON in request body" } },
      { status: 400 }
    );
  }

  // Validate body
  const parsed = enrollStudentSchema.safeParse(body);
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

  // Find student by studentCode
  const student = await Student.findOne({ studentCode: parsed.data.studentCode.trim().toUpperCase() });
  if (!student) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Student with this code not found" } },
      { status: 404 }
    );
  }

  // Check existing enrollment
  const existingEnrollment = await Enrollment.findOne({
    classId,
    studentId: student._id,
  });

  if (existingEnrollment) {
    if (existingEnrollment.status === "active") {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "ALREADY_ENROLLED", message: "Student is already enrolled in this class" } },
        { status: 409 }
      );
    }

    // Reactivate dropped enrollment
    existingEnrollment.status = "active";
    existingEnrollment.enrolledAt = new Date();
    await existingEnrollment.save();
  } else {
    // Create new enrollment
    await Enrollment.create({
      classId,
      studentId: student._id,
      status: "active",
      enrolledAt: new Date(),
    });
  }

  return NextResponse.json<ApiResponse>({
    success: true,
  });
}
