import React, { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 sm:p-6 bg-slate-50">
      <Suspense fallback={<div className="text-sm text-slate-500">Loading form...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
