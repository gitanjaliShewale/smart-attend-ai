import mongoose from "mongoose";
import { Subject, Enrollment, AttendanceSession, AttendanceRecord } from "@/models";

export interface SubjectAttendanceSummary {
  held: number;
  attended: number;
  percentage: number;
  noDataYet: boolean;
}

export interface OverallAttendanceSummary {
  held: number;
  attended: number;
  percentage: number;
  noDataYet: boolean;
}

/**
 * Calculates attendance metrics for a specific student and course subject,
 * excluding any sessions held before the student's active enrollment starting timestamp.
 */
export async function calculateSubjectAttendance(
  studentId: string | mongoose.Types.ObjectId,
  subjectId: string | mongoose.Types.ObjectId
): Promise<SubjectAttendanceSummary> {
  const subjectDoc = await Subject.findById(subjectId).lean();
  if (!subjectDoc) {
    return { held: 0, attended: 0, percentage: 0, noDataYet: true };
  }

  // Find student's active enrollment for this class
  const enrollment = await Enrollment.findOne({
    studentId,
    classId: subjectDoc.classId,
    status: "active",
  }).lean();

  if (!enrollment) {
    return { held: 0, attended: 0, percentage: 0, noDataYet: true };
  }

  // Only count sessions started after or at the student's enrollment date
  const sessions = await AttendanceSession.find({
    subjectId,
    startedAt: { $gte: enrollment.enrolledAt },
  }).lean();

  const held = sessions.length;
  if (held === 0) {
    return { held: 0, attended: 0, percentage: 0, noDataYet: true };
  }

  // Find attendance records logged in these sessions
  const records = await AttendanceRecord.find({
    studentId,
    subjectId,
    sessionId: { $in: sessions.map((s) => s._id) },
  }).lean();

  const attended = records.length;
  const percentage = (attended / held) * 100;

  return {
    held,
    attended,
    percentage: Math.round(percentage * 10) / 10,
    noDataYet: false,
  };
}

/**
 * Calculates overall attendance metrics across all active enrollments for a student.
 */
export async function calculateOverallAttendance(
  studentId: string | mongoose.Types.ObjectId
): Promise<OverallAttendanceSummary> {
  const enrollments = await Enrollment.find({
    studentId,
    status: "active",
  }).lean();

  if (enrollments.length === 0) {
    return { held: 0, attended: 0, percentage: 0, noDataYet: true };
  }

  const classIds = enrollments.map((e) => e.classId);
  const subjects = await Subject.find({ classId: { $in: classIds } }).lean();

  let totalHeld = 0;
  let totalAttended = 0;

  for (const sub of subjects) {
    const stats = await calculateSubjectAttendance(studentId, sub._id);
    totalHeld += stats.held;
    totalAttended += stats.attended;
  }

  if (totalHeld === 0) {
    return { held: 0, attended: 0, percentage: 0, noDataYet: true };
  }

  const percentage = (totalAttended / totalHeld) * 100;

  return {
    held: totalHeld,
    attended: totalAttended,
    percentage: Math.round(percentage * 10) / 10,
    noDataYet: false,
  };
}
