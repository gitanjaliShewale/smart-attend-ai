/**
 * POST /api/students/face/reset — Reset Face ID enrollment for authenticated student.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { verifyOrigin } from "@/lib/auth/security";
import { Student } from "@/models";
import { ApiResponse } from "@/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
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
      { success: false, error: { code: "FORBIDDEN", message: "Access restricted to students" } },
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

  student.faceProfile = {
    isEnrolled: false,
    enrolledAt: undefined,
    faceDescriptor: [],
    referencePhotoUrl: undefined,
  };

  await student.save();

  console.log(`[BIOMETRICS] Face ID reset: studentId=${student._id}`);

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      message: "Face ID removed successfully. You can enroll a new face profile anytime.",
      isEnrolled: false,
    },
  });
}
