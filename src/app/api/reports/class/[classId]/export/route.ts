/**
 * GET /api/reports/class/:classId/export — Export class attendance report as CSV.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Teacher, Class, Subject, Enrollment, Student } from "@/models";
import { calculateSubjectAttendance } from "@/lib/attendance/calculations";

interface RouteParams {
  params: Promise<{
    classId: string;
  }>;
}

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (session.user.role !== "teacher") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { classId } = await params;
  if (!classId || !/^[0-9a-fA-F]{24}$/.test(classId)) {
    return new NextResponse("Invalid or missing Class ID format", { status: 400 });
  }

  await connectToDatabase();

  const teacher = await Teacher.findOne({ userId: session.user.id });
  if (!teacher) {
    return new NextResponse("Teacher record not found", { status: 404 });
  }

  const classDoc = await Class.findById(classId).lean();
  if (!classDoc) {
    return new NextResponse("Class not found", { status: 404 });
  }

  // Enforce teacher-ownership check
  if (classDoc.teacherId.toString() !== teacher._id.toString()) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Fetch subjects and students enrolled
  const subjects = await Subject.find({ classId }).lean();
  const enrollments = await Enrollment.find({ classId, status: "active" }).lean();
  const studentIds = enrollments.map((e) => e.studentId);
  const students = await Student.find({ _id: { $in: studentIds } }).lean();

  // CSV Generation
  const headers = ["Student Code", "Student Name", "Subject Name", "Sessions Held", "Sessions Attended", "Attendance Rate (%)"];
  const rows = [headers.join(",")];

  for (const student of students) {
    for (const sub of subjects) {
      const stats = await calculateSubjectAttendance(student._id, sub._id);
      const rateText = stats.noDataYet ? "No Data Yet" : `${stats.percentage}%`;

      const row = [
        escapeCSV(student.studentCode),
        escapeCSV(student.fullName),
        escapeCSV(sub.name),
        escapeCSV(stats.held),
        escapeCSV(stats.attended),
        escapeCSV(rateText),
      ];

      rows.push(row.join(","));
    }
  }

  const csvContent = rows.join("\r\n");
  const sanitizedClassName = classDoc.name.replace(/[^a-zA-Z0-9]/g, "_");

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-report-${sanitizedClassName}.csv"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
