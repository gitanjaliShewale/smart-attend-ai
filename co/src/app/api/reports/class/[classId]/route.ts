/**
 * GET /api/reports/class/:classId — Fetch attendance report for a teacher's class.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Teacher, Class, Subject, Enrollment, Student } from "@/models";
import { calculateSubjectAttendance } from "@/lib/attendance/calculations";
import { getSettingValue } from "@/lib/settings";
import { ApiResponse } from "@/types";

interface RouteParams {
  params: Promise<{
    classId: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
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
      { success: false, error: { code: "FORBIDDEN", message: "Only teachers can access attendance reports" } },
      { status: 403 }
    );
  }

  const { classId } = await params;
  if (!classId || !/^[0-9a-fA-F]{24}$/.test(classId)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid or missing Class ID format" } },
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

  const classDoc = await Class.findById(classId).lean();
  if (!classDoc) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Class not found" } },
      { status: 404 }
    );
  }

  // Enforce teacher-ownership check
  if (classDoc.teacherId.toString() !== teacher._id.toString()) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "Access denied. You do not own this class." } },
      { status: 403 }
    );
  }

  const threshold = await getSettingValue("attendanceThreshold", 75);

  // Fetch subjects in this class
  const subjects = await Subject.find({ classId }).lean();

  // Fetch active enrollments in this class
  const enrollments = await Enrollment.find({ classId, status: "active" }).lean();

  // Fetch student info
  const studentIds = enrollments.map((e) => e.studentId);
  const students = await Student.find({ _id: { $in: studentIds } }).lean();

  const reportData = [];

  for (const student of students) {
    const subjectStats = [];
    let belowThresholdCount = 0;

    for (const sub of subjects) {
      const stats = await calculateSubjectAttendance(student._id, sub._id);
      const isBelow = !stats.noDataYet && stats.percentage < threshold;
      if (isBelow) {
        belowThresholdCount++;
      }

      subjectStats.push({
        subjectId: sub._id.toString(),
        subjectName: sub.name,
        held: stats.held,
        attended: stats.attended,
        percentage: stats.percentage,
        noDataYet: stats.noDataYet,
        belowThreshold: isBelow,
      });
    }

    reportData.push({
      studentId: student._id.toString(),
      studentCode: student.studentCode,
      fullName: student.fullName,
      subjects: subjectStats,
      anyBelowThreshold: belowThresholdCount > 0,
    });
  }

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      class: {
        id: classDoc._id.toString(),
        name: classDoc.name,
        academicTerm: classDoc.academicTerm,
      },
      subjects: subjects.map((s) => ({ id: s._id.toString(), name: s.name })),
      students: reportData,
      threshold,
    },
  });
}
