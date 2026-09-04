import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    newUser: "/register",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      // Unauthenticated paths
      const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
      const isApiAuth = pathname.startsWith("/api/auth");
      const isLandingPage = pathname === "/";

      if (isAuthPage) {
        if (isLoggedIn) {
          const role = auth.user.role;
          if (role === "teacher") {
            return Response.redirect(new URL("/teacher/dashboard", nextUrl));
          }
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      if (isApiAuth || isLandingPage) {
        return true;
      }

      // Role-specific protected routes
      const isTeacherRoute =
        pathname.startsWith("/teacher") ||
        pathname.startsWith("/classes") ||
        pathname.startsWith("/session") ||
        pathname.startsWith("/reports");

      const isStudentRoute =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/scan") ||
        pathname.startsWith("/attendance") ||
        pathname.startsWith("/profile");

      if (!isLoggedIn) {
        // Redirect unauthenticated user to login
        const callbackUrl = encodeURIComponent(pathname);
        return Response.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl));
      }

      const role = auth.user.role;

      if (isTeacherRoute && role !== "teacher") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      if (isStudentRoute && role !== "student") {
        return Response.redirect(new URL("/teacher/dashboard", nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.fullName = user.fullName;
        token.studentId = user.studentId;
        token.teacherId = user.teacherId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "student" | "teacher";
        session.user.fullName = token.fullName as string;
        session.user.studentId = token.studentId as string | undefined;
        session.user.teacherId = token.teacherId as string | undefined;
      }
      return session;
    },
  },
  providers: [], // Configured with full providers in auth.ts
};
