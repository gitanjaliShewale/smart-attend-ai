/**
 * POST /api/students/face/enroll — Enroll or update student facial biometric template.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { verifyOrigin } from "@/lib/auth/security";
import { Student } from "@/models";
import { normalizeFaceDescriptor } from "@/lib/biometrics";
import { ApiResponse } from "@/types";
import { z } from "zod";

const enrollFaceSchema = z.object({
  faceDescriptor: z.array(z.number()).min(16, "Face descriptor vector must have at least 16 dimensions"),
  referencePhoto: z.string().optional(),
});

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
      { success: false, error: { code: "FORBIDDEN", message: "Only students can enroll Face ID" } },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "INVALID_JSON", message: "Malformed JSON payload" } },
      { status: 400 }
    );
  }

  const parsed = enrollFaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message || "Invalid face biometric data",
        },
      },
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

  const now = new Date();
  const normalizedVector = normalizeFaceDescriptor(parsed.data.faceDescriptor);

  await Student.updateOne(
    { _id: student._id },
    {
      $set: {
        faceProfile: {
          isEnrolled: true,
          enrolledAt: now,
          faceDescriptor: normalizedVector,
          referencePhotoUrl: parsed.data.referencePhoto || null,
        },
      },
    }
  );

  console.log(`[BIOMETRICS] Face ID enrolled successfully: studentId=${student._id}, studentCode=${student.studentCode}`);

  return NextResponse.json<ApiResponse>({
    success: true,
    data: {
      message: "Face ID enrolled successfully!",
      isEnrolled: true,
      enrolledAt: now.toISOString(),
    },
  });
}
