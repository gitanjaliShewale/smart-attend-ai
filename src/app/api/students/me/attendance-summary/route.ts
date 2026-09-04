/**
 * GET /api/students/me/attendance-summary — Fetch attendance percentage stats and recent scans for student.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Student, Enrollment, Subject, Class, AttendanceRecord } from "@/models";
import { getSettingValue } from "@/lib/settings";
import { calculateSubjectAttendance, calculateOverallAttendance } from "@/lib/attendance/calculations";
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
      { success: false, error: { code: "FORBIDDEN", message: "Only students can view attendance summaries" } },
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

  // Read config settings threshold
  const threshold = await getSettingValue("attendanceThreshold", 75);

  // Find student's active enrollments
  const enrollments = await Enrollment.find({ studentId: student._id, status: "active" }).lean();

  const subjectSummaries: any[] = [];

  if (enrollments.length > 0) {
    const classIds = enrollments.map((e) => e.classId);

    // Find all subjects in these classes
    const subjects = await Subject.find({ classId: { $in: classIds } }).lean();

    for (const sub of subjects) {
      const classDoc = await Class.findById(sub.classId).lean();
      const className = classDoc?.name || "Unknown Class";

      const stats = await calculateSubjectAttendance(student._id, sub._id);
      const belowThreshold = !stats.noDataYet && stats.percentage < threshold;

      subjectSummaries.push({
        subjectId: sub._id.toString(),
        subjectName: sub.name,
        className,
        attended: stats.attended,
        held: stats.held,
        percentage: stats.percentage,
        belowThreshold,
      });
    }
  }

  // Fetch recent attendance logs (last 5 records)
  const recentRecords = await AttendanceRecord.find({ studentId: student._id })
    .sort({ serverTimestamp: -1 })
    .limit(5)
    .lean();

  const recentList: any[] = [];
  for (const rec of recentRecords) {
    const [classDoc, subjectDoc] = await Promise.all([
      Class.findById(rec.classId).lean(),
      Subject.findById(rec.subjectId).lean(),
    ]);

    recentList.push({
      recordId: rec._id.toString(),
      subjectName: subjectDoc?.name || "Unknown Subject",
      className: classDoc?.name || "Unknown Class",
      status: rec.status,
      timestamp: rec.serverTimestamp.toISOString(),
    });
  }

  // Overall attendance calculation
  const overall = await calculateOverallAttendance(student._id);

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      overall: {
        attended: overall.attended,
        held: overall.held,
        percentage: overall.percentage,
      },
      subjects: subjectSummaries,
      recent: recentList,
      threshold,
    },
  });
}
