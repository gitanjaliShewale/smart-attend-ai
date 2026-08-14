import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Use /api/teachers/me" } }, { status: 404 });
}
