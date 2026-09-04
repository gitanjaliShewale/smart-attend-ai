import { DefaultSession } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    role: "student" | "teacher";
    fullName: string;
    studentId?: string;
    teacherId?: string;
  }

  interface Session {
    user: {
      id: string;
      role: "student" | "teacher";
      fullName: string;
      studentId?: string;
      teacherId?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: "student" | "teacher";
    fullName?: string;
    studentId?: string;
    teacherId?: string;
  }
}
