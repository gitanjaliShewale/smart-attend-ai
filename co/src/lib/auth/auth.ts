import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { connectToDatabase } from "@/lib/mongodb/connection";
import { User, Student, Teacher } from "@/models";
import { loginSchema } from "@/lib/validation/auth.schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        // Rate limit: Max 5 login attempts per 60 seconds per email
        const { isRateLimited } = await import("@/lib/rate-limit");
        const emailKey = `login_email:${email.toLowerCase().trim()}`;
        if (isRateLimited(emailKey, 5, 60000)) {
          console.warn(`[SECURITY AUDIT] Login rejected: Rate limit exceeded. email=${email}`);
          return null;
        }

        await connectToDatabase();

        const user = await User.findOne({ email, isActive: true });
        if (!user || !user.passwordHash) {
          console.warn(`[SECURITY AUDIT] Login failed: User not found or inactive. email=${email}`);
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
          console.warn(`[SECURITY AUDIT] Login failed: Invalid password. userId=${user._id}`);
          return null;
        }

        let fullName = "User";
        let studentId: string | undefined;
        let teacherId: string | undefined;

        if (user.role === "student") {
          const student = await Student.findOne({ userId: user._id });
          if (student) {
            fullName = student.fullName;
            studentId = student._id.toString();
          }
        } else if (user.role === "teacher") {
          const teacher = await Teacher.findOne({ userId: user._id });
          if (teacher) {
            fullName = teacher.fullName;
            teacherId = teacher._id.toString();
          }
        }

        // Update last login timestamp
        user.lastLoginAt = new Date();
        await user.save();

        return {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          fullName,
          studentId,
          teacherId,
        };
      },
    }),
  ],
});
