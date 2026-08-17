import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { User, Student, Teacher, Class } from "@/models";

export async function GET() {
  const envStatus = {
    MONGODB_URI_SET: !!process.env.MONGODB_URI,
    MONGODB_URI_MASKED: process.env.MONGODB_URI
      ? process.env.MONGODB_URI.replace(/:([^:@]+)@/, ":****@")
      : "MISSING (Configure in Vercel Project Settings)",
    AUTH_SECRET_SET: !!process.env.AUTH_SECRET,
    AUTH_TRUST_HOST_SET: !!process.env.AUTH_TRUST_HOST,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "NOT SET",
    QR_TOKEN_SECRET_SET: !!process.env.QR_TOKEN_SECRET,
    NODE_ENV: process.env.NODE_ENV || "development",
  };

  let dbStatus = "disconnected";
  let dbError: string | null = null;
  let userCounts = { users: 0, teachers: 0, students: 0, classes: 0 };
  let demoUsersList: string[] = [];

  try {
    const conn = await connectToDatabase();
    if (conn.connection.readyState === 1) {
      dbStatus = "connected";
      const [u, t, s, c] = await Promise.all([
        User.countDocuments(),
        Teacher.countDocuments(),
        Student.countDocuments(),
        Class.countDocuments(),
      ]);
      userCounts = { users: u, teachers: t, students: s, classes: c };

      const allUsers = await User.find({}, "email role").limit(10);
      demoUsersList = allUsers.map((usr) => `${usr.email} (${usr.role})`);
    }
  } catch (err: any) {
    dbStatus = "error";
    dbError = err?.message || String(err);
  }

  const recommendations: string[] = [];

  if (!envStatus.MONGODB_URI_SET) {
    recommendations.push(
      "❌ MONGODB_URI is missing in Vercel. Add your MongoDB Atlas connection string in Vercel Dashboard -> Settings -> Environment Variables."
    );
  }
  if (!envStatus.AUTH_SECRET_SET) {
    recommendations.push(
      "❌ AUTH_SECRET is missing in Vercel. Add a 32+ character random string in Vercel Environment Variables."
    );
  }
  if (!envStatus.AUTH_TRUST_HOST_SET) {
    recommendations.push(
      "⚠️ Set AUTH_TRUST_HOST=true in Vercel Environment Variables so session callbacks work correctly."
    );
  }
  if (dbStatus === "error") {
    recommendations.push(
      `❌ Database connection failed: ${dbError}. Check that your MongoDB Atlas cluster has IP Whitelist '0.0.0.0/0' (Allow access from anywhere) and that your username/password in MONGODB_URI are correct.`
    );
  } else if (dbStatus === "connected" && userCounts.users === 0) {
    recommendations.push(
      "⚠️ Database is connected but has 0 users. Visit /api/dev-seed in your browser to seed demo accounts."
    );
  } else if (dbStatus === "connected" && userCounts.users > 0) {
    recommendations.push("✅ Database is connected and populated! Logins should work normally.");
  }

  return NextResponse.json(
    {
      status: dbStatus === "connected" && userCounts.users > 0 ? "healthy" : "action_required",
      database: {
        status: dbStatus,
        error: dbError,
        collections: userCounts,
        existingUsers: demoUsersList,
      },
      environment: envStatus,
      recommendations,
    },
    { status: dbStatus === "connected" ? 200 : 500 }
  );
}
