/**
 * GET /api/teachers/me/overview — Fetch active sessions, classes, and low attendance students.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Teacher, Class, Subject, Enrollment, Student, AttendanceSession, AttendanceRecord } from "@/models";
import { getSettingValue } from "@/lib/settings";
import { calculateSubjectAttendance } from "@/lib/attendance/calculations";
import { ApiResponse } from "@/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  if (session.user.role !== "teacher") {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "Only teachers can access this overview" } },
      { status: 403 }
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

  // 1. Get active session (if any)
  const now = new Date();
  const activeSessionDoc = await AttendanceSession.findOne({
    teacherId: teacher._id,
    status: "active",
    expiresAt: { $gt: now },
  }).lean();

  let activeSession = null;
  if (activeSessionDoc) {
    const attendanceCount = await AttendanceRecord.countDocuments({
      sessionId: activeSessionDoc._id,
    });

    const [classDoc, subjectDoc] = await Promise.all([
      Class.findById(activeSessionDoc.classId).lean(),
      Subject.findById(activeSessionDoc.subjectId).lean(),
    ]);

    activeSession = {
      sessionId: activeSessionDoc._id.toString(),
      classId: activeSessionDoc.classId.toString(),
      className: classDoc?.name || "Unknown Class",
      subjectId: activeSessionDoc.subjectId.toString(),
      subjectName: subjectDoc?.name || "Unknown Subject",
      token: activeSessionDoc.token,
      expiresAt: activeSessionDoc.expiresAt.toISOString(),
      attendanceCount,
    };
  }

  // 2. Owned classes
  const classes = await Class.find({ teacherId: teacher._id }).lean();
  const classIds = classes.map((c) => c._id);

  // 3. Find students below threshold across classes
  const threshold = await getSettingValue("attendanceThreshold", 75);
  const lowAttendanceList: any[] = [];

  if (classIds.length > 0) {
    // Find all enrollments in these classes
    const enrollments = await Enrollment.find({ classId: { $in: classIds }, status: "active" }).lean();

    for (const enrollment of enrollments) {
      // Find subjects in this class
      const subjects = await Subject.find({ classId: enrollment.classId }).lean();
      const studentDoc = await Student.findById(enrollment.studentId).lean();
      if (!studentDoc) continue;

      const classDoc = classes.find((c) => c._id.toString() === enrollment.classId.toString());
      const className = classDoc?.name || "Unknown Class";

      for (const sub of subjects) {
        const stats = await calculateSubjectAttendance(enrollment.studentId, sub._id);
        if (stats.noDataYet) continue;

        if (stats.percentage < threshold) {
          lowAttendanceList.push({
            studentId: studentDoc._id.toString(),
            studentCode: studentDoc.studentCode,
            fullName: studentDoc.fullName,
            classId: enrollment.classId.toString(),
            className,
            subjectId: sub._id.toString(),
            subjectName: sub.name,
            attended: stats.attended,
            held: stats.held,
            percentage: stats.percentage,
          });
        }
      }
    }
  }

  const formattedClasses = classes.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    academicTerm: c.academicTerm,
    isActive: c.isActive,
  }));

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      activeSession,
      classes: formattedClasses,
      lowAttendanceStudents: lowAttendanceList,
      threshold,
    },
  });
}
