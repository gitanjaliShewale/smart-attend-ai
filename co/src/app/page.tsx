import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShieldCheck,
  Smartphone,
  RefreshCw,
  GraduationCap,
  Users,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0f2b48] via-[#14365b] to-[#0a1e33] text-white py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
        {/* Subtle background grid effect */}
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff12_1px,transparent_1px)] bg-[size:32px_32px]" />

        <div className="relative max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-400/30 text-emerald-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Next-Gen Academic Integrity System</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Server-Authoritative <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-emerald-400 to-sky-300 bg-clip-text text-transparent">
              QR Attendance Platform
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            Eliminate proxy attendance and screenshot spoofing with rotating cryptographic QR tokens,
            client device fraud friction, and instantaneous classroom analytics.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link href="/dashboard">
              <Button
                variant="success"
                size="lg"
                className="gap-2 text-white font-bold shadow-lg shadow-emerald-950/40"
              >
                <GraduationCap className="w-5 h-5" />
                <span>Explore Student Dashboard</span>
              </Button>
            </Link>

            <Link href="/teacher/dashboard">
              <Button
                variant="outline"
                size="lg"
                className="gap-2 bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm"
              >
                <Users className="w-5 h-5" />
                <span>Explore Teacher Dashboard</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-16 bg-slate-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Core Security Architecture
            </h2>
            <p className="text-sm text-slate-500 max-w-xl mx-auto">
              Engineered with zero-trust principles. The client never dictates success, timestamp, or attendance status.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <Card className="border-slate-200/90 shadow-xs hover:shadow-md transition-all">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Dynamic Rotating QR</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Cryptographic session tokens rotate every 5–10 seconds. Shared screenshots expire immediately, preventing remote attendance fraud.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/90 shadow-xs hover:shadow-md transition-all">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Device Identity Lock</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Client browser UUID binding enforces one active device per student with auditable re-registration to prevent multi-account proxy scanning.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/90 shadow-xs hover:shadow-md transition-all">
              <CardContent className="p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">DB-Level Duplicate Guard</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Compound unique indexing on <code>(sessionId, studentId)</code> guarantees atomic concurrency protection against race conditions.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
