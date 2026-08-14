/**
 * GET  /api/teachers/me  — Returns the authenticated teacher's own profile.
 * PATCH /api/teachers/me — Updates fullName only. Identity derived from session.
 *
 * Security: No teacherId is accepted from the client at any point.
 * The teacher's identity is resolved exclusively from the JWT session.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { User, Teacher } from "@/models";
import { updateTeacherProfileSchema } from "@/lib/validation/teacher.schema";
import { verifyOrigin } from "@/lib/auth/security";
import { ApiResponse } from "@/types";

// --------------------------------------------------------------------------
// GET /api/teachers/me
// --------------------------------------------------------------------------
export async function GET(): Promise<NextResponse> {
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

  const teacher = await Teacher.findOne({ userId: session.user.id }).lean();
  if (!teacher) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Teacher profile not found" } },
      { status: 404 }
    );
  }

  const user = await User.findById(session.user.id, "email").lean();

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      teacherId: teacher._id.toString(),
      userId: session.user.id,
      fullName: teacher.fullName,
      email: user?.email ?? session.user.email,
      role: "teacher",
    },
  });
}

// --------------------------------------------------------------------------
// PATCH /api/teachers/me
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

  const parsed = updateTeacherProfileSchema.safeParse(body);
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
      { success: false, error: { code: "NOT_FOUND", message: "Teacher profile not found" } },
      { status: 404 }
    );
  }

  teacher.fullName = parsed.data.fullName.trim();
  await teacher.save();

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      teacherId: teacher._id.toString(),
      fullName: teacher.fullName,
    },
  });
}
