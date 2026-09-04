import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/lib/auth/register";
import { verifyOrigin } from "@/lib/auth/security";
import { ApiResponse } from "@/types";

export async function POST(request: NextRequest) {
  // 1. Verify CSRF / Origin Header
  const originCheck = verifyOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: originCheck.error || "Cross-origin request rejected",
        },
      },
      { status: 403 }
    );
  }

  // 2. Apply rate limiting (Max 10 registration requests per 60 seconds per IP)
  const { isRateLimited } = await import("@/lib/rate-limit");
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const ipKey = `register_ip:${ip}`;
  if (isRateLimited(ipKey, 10, 60000)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many registration requests. Please try again later." } },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const result = await registerUser(body);

    if (!result.success) {
      const status =
        result.error?.code === "INVALID_INPUT"
          ? 400
          : result.error?.code === "REGISTRATION_FAILED"
          ? 400
          : 500;

      return NextResponse.json<ApiResponse>(result, { status });
    }

    return NextResponse.json<ApiResponse>(result, { status: 201 });
  } catch {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: {
          code: "INVALID_JSON",
          message: "Malformed JSON payload in request body",
        },
      },
      { status: 400 }
    );
  }
}
