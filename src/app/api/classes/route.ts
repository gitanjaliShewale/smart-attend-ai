/**
 * GET  /api/classes  — Retrieve classes for authenticated teacher or student.
 * POST /api/classes  — Create a new class (Teacher only).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Class, Teacher, Student, Enrollment } from "@/models";
import { createClassSchema } from "@/lib/validation/class.schema";
import { verifyOrigin } from "@/lib/auth/security";
import { ApiResponse } from "@/types";

// --------------------------------------------------------------------------
// GET /api/classes
// --------------------------------------------------------------------------
export async function GET(): Promise<NextResponse> {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  await connectToDatabase();

  const role = session.user.role;

  if (role === "teacher") {
    // 1. Fetch teacher record
    const teacher = await Teacher.findOne({ userId: session.user.id }).lean();
    if (!teacher) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "NOT_FOUND", message: "Teacher record not found" } },
        { status: 404 }
      );
    }

    // 2. Fetch classes owned by this teacher
    const classes = await Class.find({ teacherId: teacher._id }).sort({ createdAt: -1 }).lean();

    return NextResponse.json<ApiResponse>({
      success: true,
      data: classes.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        academicTerm: c.academicTerm,
        isActive: c.isActive,
        createdAt: c.createdAt,
      })),
    });
  } else if (role === "student") {
    // 1. Fetch student record
    const student = await Student.findOne({ userId: session.user.id }).lean();
    if (!student) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: "NOT_FOUND", message: "Student record not found" } },
        { status: 404 }
      );
    }

    // 2. Fetch student's active enrollments, populating class details
    const enrollments = await Enrollment.find({ studentId: student._id, status: "active" })
      .populate("classId")
      .sort({ enrolledAt: -1 })
      .lean();

    const classes = enrollments
      .map((e) => {
        const c = e.classId as unknown as (typeof Class.prototype & { _id: any; name: string; academicTerm: string; isActive: boolean; createdAt: Date });
        if (!c || !c.isActive) return null;
        return {
          id: c._id.toString(),
          name: c.name,
          academicTerm: c.academicTerm,
          isActive: c.isActive,
          enrolledAt: e.enrolledAt,
        };
      })
      .filter(Boolean);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: classes,
    });
  }

  return NextResponse.json<ApiResponse>(
    { success: false, error: { code: "FORBIDDEN", message: "Role not authorized" } },
    { status: 403 }
  );
}

// --------------------------------------------------------------------------
// POST /api/classes
// --------------------------------------------------------------------------
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

  const parsed = createClassSchema.safeParse(body);
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

  const teacher = await Teacher.findOne({ userId: session.user.id });
  if (!teacher) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Teacher record not found" } },
      { status: 404 }
    );
  }

  const newClass = await Class.create({
    name: parsed.data.name.trim(),
    academicTerm: parsed.data.academicTerm.trim(),
    teacherId: teacher._id,
    isActive: true,
  });

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      id: newClass._id.toString(),
      name: newClass.name,
      academicTerm: newClass.academicTerm,
      isActive: newClass.isActive,
    },
  });
}
