"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { loginSchema } from "@/lib/validation/auth.schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  QrCode,
  Lock,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  GraduationCap,
  BookOpen,
  Hash,
} from "lucide-react";

type Role = "student" | "teacher";

// ── Demo credentials ──────────────────────────────────────────────────────────
const STUDENT_DEMOS = [
  { name: "Gitanjali Shewale", email: "gitanjali.shewale@university.edu", code: "STU1024" },
  { name: "Sameer Tamboli",    email: "sameer.tamboli@university.edu",    code: "STU1025" },
  { name: "Karan Nagare",      email: "karan.nagare@university.edu",      code: "STU1026" },
  { name: "Vedant Deore",      email: "vedant.deore@university.edu",      code: "STU1027" },
];

const TEACHER_DEMOS = [
  { name: "Varsha Sahane",  email: "varsha.sahane@university.edu" },
  { name: "Aashish Kale",  email: "aashish.kale@university.edu"  },
  { name: "Nilesh Sharma", email: "nilesh.sharma@university.edu"  },
];

const SHARED_PASSWORD = "Password123!";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "";

  const [role, setRole] = React.useState<Role>("student");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<{ email?: string; password?: string }>({});
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const isTeacher = role === "teacher";

  // ── Accent colours per role ───────────────────────────────────────────────
  const accent     = isTeacher ? "#0f2b48" : "#1e6b3c";   // navy / forest-green
  const accentBg   = isTeacher ? "bg-[#0f2b48]" : "bg-[#1e6b3c]";
  const accentRing = isTeacher
    ? "focus:border-[#0f2b48] focus:ring-[#0f2b48]/20"
    : "focus:border-[#1e6b3c] focus:ring-[#1e6b3c]/20";
  const accentText  = isTeacher ? "text-[#0f2b48]" : "text-[#1e6b3c]";
  const accentTab   = isTeacher
    ? "bg-[#0f2b48] text-white shadow"
    : "bg-[#1e6b3c] text-white shadow";

  // ── Role switch ───────────────────────────────────────────────────────────
  const switchRole = (r: Role) => {
    setRole(r);
    setEmail("");
    setPassword("");
    setFieldErrors({});
    setErrorMessage(null);
  };

  // ── Auto-fill first demo account for current role ─────────────────────────
  const fillDemo = () => {
    const demo = isTeacher ? TEACHER_DEMOS[0] : STUDENT_DEMOS[0];
    setEmail(demo.email);
    setPassword(SHARED_PASSWORD);
    setFieldErrors({});
    setErrorMessage(null);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const f = validation.error.format();
      setFieldErrors({
        email: f.email?._errors[0],
        password: f.password?._errors[0],
      });
      return;
    }

    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: validation.data.email,
        password: validation.data.password,
        redirect: false,
      });

      if (!result || result.error) {
        setErrorMessage(
          isTeacher
            ? "Invalid institutional email or password."
            : "Invalid student email or password."
        );
        setLoading(false);
        return;
      }

      // Determine clean destination (avoid redirect loops back to login/register)
      let dest = isTeacher ? "/teacher/dashboard" : "/dashboard";
      if (callbackUrl && !callbackUrl.startsWith("/login") && !callbackUrl.startsWith("/register")) {
        // Validate that student isn't redirected to teacher routes or vice-versa
        if (isTeacher && !callbackUrl.startsWith("/dashboard") && !callbackUrl.startsWith("/scan")) {
          dest = callbackUrl;
        } else if (!isTeacher && !callbackUrl.startsWith("/teacher")) {
          dest = callbackUrl;
        }
      }

      // Hard redirect to load new session state cleanly across browsers and tunnels
      window.location.href = dest;
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-slate-200/90 shadow-lg overflow-hidden">
      {/* ── Role Switcher ───────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200">
        <button
          id="role-tab-student"
          type="button"
          onClick={() => switchRole("student")}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition-all duration-200 ${
            !isTeacher ? accentTab : "bg-slate-50 text-slate-500 hover:text-slate-700"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Student Login
        </button>
        <button
          id="role-tab-teacher"
          type="button"
          onClick={() => switchRole("teacher")}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition-all duration-200 ${
            isTeacher ? accentTab : "bg-slate-50 text-slate-500 hover:text-slate-700"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Institutional Login
        </button>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <CardHeader className="space-y-2 text-center pb-4 pt-5">
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${accentBg} text-white shadow-md transition-colors duration-300`}
        >
          {isTeacher ? <BookOpen className="w-6 h-6" /> : <GraduationCap className="w-6 h-6" />}
        </div>
        <CardTitle className="text-xl font-extrabold text-slate-900 tracking-tight">
          {isTeacher ? "Faculty / Institutional Login" : "Student Portal Login"}
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          {isTeacher
            ? "Sign in with your university-issued faculty credentials."
            : "Sign in with your enrolled student email and password."}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              {isTeacher ? "Institutional Email" : "Student Email"}
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                isTeacher
                  ? "e.g. varsha.sahane@university.edu"
                  : "e.g. gitanjali.shewale@university.edu"
              }
              disabled={loading}
              className={`w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:opacity-50 ${accentRing}`}
            />
            {fieldErrors.email && (
              <p className="text-xs text-rose-600 mt-1">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className={`w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:opacity-50 ${accentRing}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-xs text-rose-600 mt-1">{fieldErrors.password}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className={`w-full mt-2 text-white font-semibold py-2.5 rounded-lg transition-all ${accentBg} hover:opacity-90`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Authenticating...
              </span>
            ) : isTeacher ? (
              "Sign In — Institutional"
            ) : (
              "Sign In — Student Portal"
            )}
          </Button>
        </CardContent>

        {/* ── Footer: credentials reference ──────────────────────────── */}
        <CardFooter className="flex flex-col space-y-3 pt-0 text-center">
          <p className="text-xs text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className={`font-semibold ${accentText} hover:underline`}>
              Create an account
            </Link>
          </p>

          {/* Demo panel */}
          <div className="w-full p-3 bg-slate-50 rounded-lg text-[11px] text-slate-500 text-left border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">
                {isTeacher ? "Faculty Demo Accounts" : "Student Demo Accounts"}
              </span>
              <button
                type="button"
                id="fill-demo-btn"
                onClick={fillDemo}
                className={`text-[10px] font-semibold ${accentText} hover:underline`}
              >
                Auto-fill first ↗
              </button>
            </div>

            {/* Password badge */}
            <div className="flex items-center gap-1.5 text-slate-500">
              <Lock className="w-3 h-3" />
              Password for all:{" "}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                {SHARED_PASSWORD}
              </code>
            </div>

            {isTeacher ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-[10px]">
                    <th className="pb-1 font-medium">Name</th>
                    <th className="pb-1 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {TEACHER_DEMOS.map((t) => (
                    <tr
                      key={t.email}
                      className="hover:bg-slate-100 cursor-pointer transition-colors"
                      onClick={() => { setEmail(t.email); setPassword(SHARED_PASSWORD); }}
                    >
                      <td className="py-1 pr-2 font-medium text-slate-700">{t.name}</td>
                      <td className="py-1 font-mono text-[10px] text-slate-500">{t.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-[10px]">
                    <th className="pb-1 font-medium">Name</th>
                    <th className="pb-1 font-medium">Email</th>
                    <th className="pb-1 font-medium">
                      <span className="flex items-center gap-0.5"><Hash className="w-2.5 h-2.5" />Code</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {STUDENT_DEMOS.map((s) => (
                    <tr
                      key={s.email}
                      className="hover:bg-slate-100 cursor-pointer transition-colors"
                      onClick={() => { setEmail(s.email); setPassword(SHARED_PASSWORD); }}
                    >
                      <td className="py-1 pr-2 font-medium text-slate-700">{s.name}</td>
                      <td className="py-1 pr-2 font-mono text-[10px] text-slate-500">{s.email}</td>
                      <td className="py-1 text-slate-500">{s.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="text-[10px] text-slate-400 pt-1">
              💡 Click any row to auto-fill credentials.
            </p>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
