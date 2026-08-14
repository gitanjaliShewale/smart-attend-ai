"use client";

import * as React from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { DashboardCard } from "@/components/layout/DashboardCard";
import { StatBadge } from "@/components/ui/StatBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  QrCode,
  BookOpen,
  Calendar,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useSession } from "next-auth/react";

interface ClassItem {
  id: string;
  name: string;
  academicTerm: string;
  isActive: boolean;
  enrolledAt?: string;
}

const THRESHOLD = 75;

export function StudentDashboardClient() {
  const { data: session } = useSession();
  const [classes, setClasses] = React.useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = React.useState(true);
  const [summary, setSummary] = React.useState<any>(null);
  const [loadingSummary, setLoadingSummary] = React.useState(true);

  const [deviceStatusText, setDeviceStatusText] = React.useState<string>("Checking...");
  const [deviceBadgeVariant, setDeviceBadgeVariant] = React.useState<"secondary" | "success" | "destructive">("secondary");
  const [deviceDesc, setDeviceDesc] = React.useState<string>("Verifying your browser...");

  React.useEffect(() => {
    fetch("/api/classes")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setClasses(d.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingClasses(false));

    fetch("/api/students/me/attendance-summary")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSummary(d.data);
      })
      .catch(() => {})
      .finally(() => setLoadingSummary(false));

    // Fetch and handle device status
    const checkDevice = async () => {
      try {
        const res = await fetch("/api/devices/me");
        const data = await res.json();
        if (!res.ok || !data.success) {
          setDeviceStatusText("Error");
          setDeviceBadgeVariant("destructive");
          setDeviceDesc("Could not load device details");
          return;
        }

        const isRegistered = data.data.registered;
        const serverId = data.data.deviceUuid;

        let clientUuid = localStorage.getItem("attendqr_device_uuid");

        if (!isRegistered) {
          if (!clientUuid) {
            clientUuid = crypto.randomUUID();
            localStorage.setItem("attendqr_device_uuid", clientUuid);
          }
          const regRes = await fetch("/api/devices/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceUuid: clientUuid }),
          });
          const regData = await regRes.json();
          if (regRes.ok && regData.success) {
            setDeviceStatusText("Active");
            setDeviceBadgeVariant("success");
            setDeviceDesc("This browser was auto-registered");
          } else {
            setDeviceStatusText("Unregistered");
            setDeviceBadgeVariant("secondary");
            setDeviceDesc("Device auto-registration failed");
          }
        } else {
          if (clientUuid === serverId) {
            setDeviceStatusText("Active");
            setDeviceBadgeVariant("success");
            setDeviceDesc("Browser registered and verified");
          } else {
            setDeviceStatusText("Mismatch");
            setDeviceBadgeVariant("destructive");
            setDeviceDesc("Another browser/device is active");
          }
        }
      } catch {
        setDeviceStatusText("Offline");
        setDeviceBadgeVariant("secondary");
        setDeviceDesc("Failed to connect to device API");
      }
    };
    checkDevice();
  }, []);

  const studentName = session?.user?.fullName ?? "Student";
  const studentId = session?.user?.studentId ?? "—";

  const overallAttended = summary?.overall?.attended ?? 0;
  const overallHeld = summary?.overall?.held ?? 0;
  const overallPercentage = summary?.overall?.percentage ?? 0;
  const thresholdVal = summary?.threshold ?? 75;

  const lowAttendanceSubjects = summary?.subjects?.filter((s: any) => s.belowThreshold) ?? [];

  return (
    <PageContainer
      title={`Welcome back, ${studentName}`}
      description={`${studentId ? `Student ID: ${studentId} • ` : ""}Academic Term: Fall 2026`}
      badge={
        <Badge variant="secondary" className="gap-1 bg-slate-100 text-slate-700">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Verified Session
        </Badge>
      }
      actions={
        <Link href="/scan">
          <Button variant="primary" size="lg" className="gap-2 shadow-md">
            <QrCode className="w-5 h-5" />
            <span>Scan Attendance QR</span>
          </Button>
        </Link>
      }
    >
      <div className="space-y-8">
        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <DashboardCard
            title="Enrolled Classes"
            value={loadingClasses ? "—" : classes.length}
            description="Active course registrations this term"
            icon={<BookOpen className="w-5 h-5 text-[#0f2b48]" />}
          />
          <DashboardCard
            title="Classes Attended"
            value={loadingSummary ? "—" : `${overallAttended} / ${overallHeld}`}
            description="Overall attendance ratio"
            icon={<Calendar className="w-5 h-5 text-[#0f2b48]" />}
          />
          <DashboardCard
            title="Attendance Rate"
            value={loadingSummary ? "—%" : `${overallPercentage}%`}
            statBadge={<StatBadge percentage={overallPercentage} threshold={thresholdVal} size="sm" />}
            description="Overall attendance rate"
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            progress={{
              value: overallPercentage,
              max: 100,
              threshold: thresholdVal,
            }}
          />
          <DashboardCard
            title="Device Lock"
            value={deviceStatusText}
            description={deviceDesc}
            icon={<Smartphone className="w-5 h-5 text-[#0f2b48]" />}
            statBadge={
              <Badge variant={deviceBadgeVariant} className="text-xs">
                {deviceStatusText === "Active" ? "Verified" : deviceStatusText}
              </Badge>
            }
          />
        </div>

        {/* Enrolled Classes grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Your Enrolled Classes</h2>
              <p className="text-xs text-slate-500">Classes you are currently enrolled in this term</p>
            </div>
            <Link href="/attendance" className="text-xs font-semibold text-[#0f2b48] hover:underline flex items-center gap-1">
              Attendance History <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loadingSummary ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#0f2b48]" />
            </div>
          ) : !summary || summary.subjects.length === 0 ? (
            <Card className="border-dashed border-slate-300">
              <CardContent className="py-12 text-center text-sm text-slate-500">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-medium text-slate-600">No active classes enrolled yet</p>
                <p className="text-xs mt-1">Enrollment data is managed by your course instructors.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.subjects.map((sub: any) => (
                <Card key={sub.subjectId} className="border-slate-200 hover:shadow-md transition-all">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[11px] truncate max-w-[120px]">
                        {sub.className}
                      </Badge>
                      {sub.belowThreshold && (
                        <Badge variant="warning" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 border gap-0.5">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Low Attendance
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-sm font-bold text-slate-900 mt-2 truncate">
                      {sub.subjectName}
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      Ratio: {sub.attended} / {sub.held} sessions held
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
                      <span>Course Rate</span>
                      <StatBadge percentage={sub.percentage} threshold={thresholdVal} size="sm" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Quick scan CTA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Recent Scans</h2>
            <p className="text-xs text-slate-500">Latest attendance marks validated by server</p>
            <Card className="border-slate-200/90 overflow-hidden shadow-sm">
              <CardContent className="p-0">
                {loadingSummary ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[#0f2b48]" />
                  </div>
                ) : !summary || summary.recent.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p>No recent attendance scans found.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {summary.recent.map((rec: any) => (
                      <div key={rec.recordId} className="flex items-center justify-between p-4 hover:bg-slate-50/60 transition-colors">
                        <div className="space-y-0.5 text-left">
                          <p className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                            {rec.subjectName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {rec.className} • {new Date(rec.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <Badge variant="success" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200 border">
                          Present
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900">Attendance Alerts</h2>
            </div>
            {loadingSummary ? (
              <Card className="border-slate-200 bg-slate-50/50">
                <CardContent className="py-6 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0f2b48]" />
                </CardContent>
              </Card>
            ) : lowAttendanceSubjects.length === 0 ? (
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="py-6 text-center text-xs text-emerald-800 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Excellent! All your course subject attendance rates are in good standing (&gt;= {thresholdVal}%).</span>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-amber-200 bg-amber-50/40">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-semibold text-amber-800">
                    The following course subjects are currently below the {thresholdVal}% threshold:
                  </p>
                  <ul className="text-xs text-amber-700 list-disc list-inside space-y-1">
                    {lowAttendanceSubjects.map((s: any) => (
                      <li key={s.subjectId}>
                        <span className="font-bold">{s.subjectName}</span> ({s.className}) — currently <span className="font-semibold text-rose-600">{s.percentage}%</span> ({s.attended}/{s.held})
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card className="bg-gradient-to-br from-[#0f2b48] to-[#1a4470] text-white border-0 shadow-md">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-400" />
                  Ready to Mark Attendance?
                </CardTitle>
                <CardDescription className="text-slate-300 text-xs">
                  Scan the dynamic rotating QR code projected in your classroom.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-3">
                <Link href="/scan">
                  <Button variant="success" className="w-full text-xs font-semibold py-2.5">
                    Launch Camera Scanner
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
