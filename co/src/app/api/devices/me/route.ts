/**
 * GET /api/devices/me — Retrieve authenticated student's active device registration status.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { Student } from "@/models";
import { getActiveDeviceForStudent } from "@/lib/device";
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
      { success: false, error: { code: "FORBIDDEN", message: "Only students have browser device registrations" } },
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

  const activeDevice = await getActiveDeviceForStudent(student._id);

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      registered: !!activeDevice,
      deviceUuid: activeDevice?.deviceUuid,
    },
  });
}
