/**
 * GET  /api/subjects?classId=xxx — List subjects for a class.
 * POST /api/subjects             — Create a subject in a class (Teacher only).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Subject, Class, Teacher, Student, Enrollment } from "@/models";
import { createSubjectSchema } from "@/lib/validation/subject.schema";
import { verifyOrigin } from "@/lib/auth/security";
import { ApiResponse } from "@/types";

// --------------------------------------------------------------------------
// GET /api/subjects?classId=<id>
// --------------------------------------------------------------------------
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const classId = request.nextUrl.searchParams.get("classId");
  if (!classId || !/^[0-9a-fA-F]{24}$/.test(classId)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INVALID_INPUT", message: "Valid classId query parameter is required" } },
      { status: 400 }
    );
  }

  await connectToDatabase();

  // Authorization: verify the class exists and the user has access
  const classDoc = await Class.findById(classId).lean();
  if (!classDoc) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Class not found" } },
      { status: 404 }
    );
  }

  let isAuthorized = false;
  if (session.user.role === "teacher") {
    const teacher = await Teacher.findOne({ userId: session.user.id }).lean();
    if (teacher && classDoc.teacherId.toString() === teacher._id.toString()) {
      isAuthorized = true;
    }
  } else if (session.user.role === "student") {
    const student = await Student.findOne({ userId: session.user.id }).lean();
    if (student) {
      const enrollment = await Enrollment.findOne({ classId, studentId: student._id, status: "active" }).lean();
      if (enrollment) isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "Access denied to this class" } },
      { status: 403 }
    );
  }

  const subjects = await Subject.find({ classId }).sort({ name: 1 }).lean();

  return NextResponse.json<ApiResponse>({
    success: true,
    data: subjects.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      classId: s.classId.toString(),
    })),
  });
}

// --------------------------------------------------------------------------
// POST /api/subjects
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

  const parsed = createSubjectSchema.safeParse(body);
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

  // Verify teacher owns the target class
  const classDoc = await Class.findById(parsed.data.classId);
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

  const subject = await Subject.create({
    name: parsed.data.name.trim(),
    classId: parsed.data.classId,
  });

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      id: subject._id.toString(),
      name: subject.name,
      classId: subject.classId.toString(),
    },
  });
}
