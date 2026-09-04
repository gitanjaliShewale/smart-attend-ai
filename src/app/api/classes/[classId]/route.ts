/**
 * GET /api/classes/[classId] — Get detailed class info, subjects list, and student roster.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Class, Teacher, Student, Enrollment, Subject } from "@/models";
import { ApiResponse } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
): Promise<NextResponse> {
  const { classId } = await params;

  // Validate classId format
  if (!/^[0-9a-fA-F]{24}$/.test(classId)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INVALID_INPUT", message: "Invalid Class ID format" } },
      { status: 400 }
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  await connectToDatabase();

  // Find class
  const classDoc = await Class.findById(classId).lean();
  if (!classDoc) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Class not found" } },
      { status: 404 }
    );
  }

  // Authorization check based on role
  const role = session.user.role;
  let isAuthorized = false;

  if (role === "teacher") {
    const teacher = await Teacher.findOne({ userId: session.user.id }).lean();
    if (teacher && classDoc.teacherId.toString() === teacher._id.toString()) {
      isAuthorized = true;
    }
  } else if (role === "student") {
    const student = await Student.findOne({ userId: session.user.id }).lean();
    if (student) {
      const activeEnrollment = await Enrollment.findOne({
        classId,
        studentId: student._id,
        status: "active",
      }).lean();
      if (activeEnrollment) {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "Access denied to this class" } },
      { status: 403 }
    );
  }

  // Retrieve subjects belonging to this class
  const subjects = await Subject.find({ classId }).sort({ name: 1 }).lean();

  // Retrieve student roster (active enrollments) with populated student details and user email
  const roster = await Enrollment.find({ classId, status: "active" })
    .populate({
      path: "studentId",
      populate: {
        path: "userId",
        select: "email",
      },
    })
    .sort({ enrolledAt: 1 })
    .lean();

  // Map roster to clean client representation
  const students = roster
    .map((e) => {
      const s = e.studentId as unknown as {
        _id: any;
        fullName: string;
        studentCode: string;
        userId?: { email: string };
      };
      if (!s) return null;
      return {
        studentId: s._id.toString(),
        studentCode: s.studentCode,
        fullName: s.fullName,
        email: s.userId?.email ?? "",
        enrolledAt: e.enrolledAt,
      };
    })
    .filter(Boolean);

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      class: {
        id: classDoc._id.toString(),
        name: classDoc.name,
        academicTerm: classDoc.academicTerm,
        isActive: classDoc.isActive,
      },
      subjects: subjects.map((sub) => ({
        id: sub._id.toString(),
        name: sub.name,
      })),
      students,
    },
  });
}
