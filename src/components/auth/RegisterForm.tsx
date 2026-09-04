"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { registerSchema } from "@/lib/validation/auth.schema";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { QrCode, Lock, Mail, User, AlertCircle, Eye, EyeOff, Loader2, GraduationCap, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function RegisterForm() {
  const router = useRouter();

  const [role, setRole] = React.useState<"student" | "teacher">("student");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [studentCode, setStudentCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match" });
      return;
    }

    const payload = {
      email,
      password,
      fullName,
      role,
      studentCode: role === "student" ? studentCode : undefined,
    };

    const validation = registerSchema.safeParse(payload);
    if (!validation.success) {
      const formatted = validation.error.format();
      const errors: Record<string, string> = {};
      if (formatted.email?._errors[0]) errors.email = formatted.email._errors[0];
      if (formatted.password?._errors[0]) errors.password = formatted.password._errors[0];
      if (formatted.fullName?._errors[0]) errors.fullName = formatted.fullName._errors[0];
      if (formatted.studentCode?._errors[0]) errors.studentCode = formatted.studentCode._errors[0];
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(
          data.error?.message || "Registration failed. Please verify your details."
        );
        setLoading(false);
        return;
      }

      // Auto sign-in on successful registration
      const loginResult = await signIn("credentials", {
        email: payload.email,
        password: payload.password,
        redirect: false,
      });

      if (loginResult?.ok) {
        window.location.href = role === "teacher" ? "/teacher/dashboard" : "/dashboard";
      } else {
        window.location.href = "/login";
      }
    } catch {
      setErrorMessage("An unexpected error occurred during registration. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-slate-200/90 shadow-lg">
      <CardHeader className="space-y-2 text-center pb-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#0f2b48] text-white shadow-md">
          <QrCode className="w-6 h-6" />
        </div>
        <CardTitle className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Create an Account
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Register with your institutional credentials to get started.
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

          {/* Role Toggle Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Account Role
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setRole("student")}
                className={cn(
                  "py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                  role === "student"
                    ? "bg-white text-[#0f2b48] shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Student</span>
              </button>
              <button
                type="button"
                onClick={() => setRole("teacher")}
                className={cn(
                  "py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                  role === "teacher"
                    ? "bg-white text-[#0f2b48] shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <User className="w-4 h-4" />
                <span>Teacher / Instructor</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Johnson"
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f2b48] focus:outline-none focus:ring-2 focus:ring-[#0f2b48]/20 disabled:opacity-50"
            />
            {fieldErrors.fullName && (
              <p className="text-xs text-rose-600 mt-1">{fieldErrors.fullName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              Institutional Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. student@university.edu"
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f2b48] focus:outline-none focus:ring-2 focus:ring-[#0f2b48]/20 disabled:opacity-50"
            />
            {fieldErrors.email && (
              <p className="text-xs text-rose-600 mt-1">{fieldErrors.email}</p>
            )}
          </div>

          {role === "student" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                Student Code / Roll Number
              </label>
              <input
                type="text"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                placeholder="e.g. STU1024"
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 uppercase placeholder:text-slate-400 focus:border-[#0f2b48] focus:outline-none focus:ring-2 focus:ring-[#0f2b48]/20 disabled:opacity-50"
              />
              {fieldErrors.studentCode && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.studentCode}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 chars (upper, lower, digit, special)"
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f2b48] focus:outline-none focus:ring-2 focus:ring-[#0f2b48]/20 disabled:opacity-50"
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

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
              Confirm Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f2b48] focus:outline-none focus:ring-2 focus:ring-[#0f2b48]/20 disabled:opacity-50"
            />
            {fieldErrors.confirmPassword && (
              <p className="text-xs text-rose-600 mt-1">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={loading}
            className="w-full mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Creating Account...
              </span>
            ) : (
              "Complete Registration"
            )}
          </Button>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2 pt-0 text-center">
          <p className="text-xs text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-[#0f2b48] hover:underline">
              Sign In
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
