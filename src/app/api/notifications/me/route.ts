/**
 * GET /api/notifications/me — Fetch student's notifications and unread count.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Student, Notification } from "@/models";
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
      { success: false, error: { code: "FORBIDDEN", message: "Only students can view their notifications" } },
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

  const notifications = await Notification.find({ studentId: student._id })
    .sort({ sentAt: -1 })
    .lean();

  const unreadCount = await Notification.countDocuments({
    studentId: student._id,
    isRead: false,
  });

  const formattedNotifications = notifications.map((n) => ({
    id: n._id.toString(),
    type: n.type,
    subjectId: n.subjectId?.toString() || null,
    message: n.message,
    attendancePercentAtSend: n.attendancePercentAtSend,
    isRead: n.isRead,
    sentAt: n.sentAt.toISOString(),
  }));

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      notifications: formattedNotifications,
      unreadCount,
    },
  });
}
