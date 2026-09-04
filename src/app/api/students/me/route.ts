/**
 * GET  /api/students/me  — Returns the authenticated student's own profile.
 * PATCH /api/students/me — Updates fullName only. Identity derived from session.
 *
 * Security: No studentId is accepted from the client at any point.
 * The student's identity is resolved exclusively from the JWT session.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { User, Student } from "@/models";
import { updateStudentProfileSchema } from "@/lib/validation/student.schema";
import { verifyOrigin } from "@/lib/auth/security";
import { ApiResponse } from "@/types";

// --------------------------------------------------------------------------
// GET /api/students/me
// --------------------------------------------------------------------------
export async function GET(): Promise<NextResponse> {
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

  const student = await Student.findOne({ userId: session.user.id }).lean();
  if (!student) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Student profile not found" } },
      { status: 404 }
    );
  }

  const user = await User.findById(session.user.id, "email").lean();

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      studentId: student._id.toString(),
      userId: session.user.id,
      studentCode: student.studentCode,
      fullName: student.fullName,
      email: user?.email ?? session.user.email,
      role: "student",
    },
  });
}

// --------------------------------------------------------------------------
// PATCH /api/students/me
// --------------------------------------------------------------------------
export async function PATCH(request: NextRequest): Promise<NextResponse> {
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

  if (session.user.role !== "student") {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "Access restricted to students" } },
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

  const parsed = updateStudentProfileSchema.safeParse(body);
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

  const student = await Student.findOne({ userId: session.user.id });
  if (!student) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Student profile not found" } },
      { status: 404 }
    );
  }

  student.fullName = parsed.data.fullName.trim();
  await student.save();

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      studentId: student._id.toString(),
      studentCode: student.studentCode,
      fullName: student.fullName,
    },
  });
}
