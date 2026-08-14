/**
 * PATCH /api/notifications/[id]/read — Mark a notification as read.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Student, Notification } from "@/models";
import { verifyOrigin } from "@/lib/auth/security";
import { ApiResponse } from "@/types";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
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

  if (session.user.role !== "student") {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "FORBIDDEN", message: "Only students can mark notifications as read" } },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid or missing notification ID" } },
      { status: 400 }
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

  // Update notification document if it belongs to this student
  const notification = await Notification.findOneAndUpdate(
    { _id: id, studentId: student._id },
    { $set: { isRead: true } },
    { new: true }
  );

  if (!notification) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "NOT_FOUND", message: "Notification not found or access denied" } },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse>({
    success: true,
  });
}
