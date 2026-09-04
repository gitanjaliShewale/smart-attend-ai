"use client";

import * as React from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  QrCode,
  Square,
  Users,
  AlertTriangle,
  RefreshCw,
  Clock,
  BookOpen,
  CheckCircle2,
  FileBarChart2,
  Maximize2,
  Loader2,
  Play,
  Settings,
  Copy,
  Check,
} from "lucide-react";
import { useSession } from "next-auth/react";

interface ClassItem {
  id: string;
  name: string;
  academicTerm: string;
  isActive: boolean;
}

interface SubjectItem {
  id: string;
  name: string;
}

interface ActiveSessionDetails {
  sessionId: string;
  token: string;
  expiresAt: string;
  qrDataUrl: string;
  qrRotationSeconds: number;
  className: string;
  subjectName: string;
  classId: string;
  subjectId: string;
}

export function TeacherDashboardClient() {
  const { data: session } = useSession();
  const [classes, setClasses] = React.useState<ClassItem[]>([]);
  const [subjects, setSubjects] = React.useState<SubjectItem[]>([]);
  const [selectedClassId, setSelectedClassId] = React.useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>("");

  const [activeSession, setActiveSession] = React.useState<ActiveSessionDetails | null>(null);
  const [lowAttendanceStudents, setLowAttendanceStudents] = React.useState<any[]>([]);
  const [threshold, setThreshold] = React.useState<number>(75);

  // Live roster details
  const [liveRoster, setLiveRoster] = React.useState<any[]>([]);
  const [liveCount, setLiveCount] = React.useState<number>(0);
  const [copiedToken, setCopiedToken] = React.useState<boolean>(false);

  // Loading / error states
  const [loading, setLoading] = React.useState<boolean>(true);
  const [subjectsLoading, setSubjectsLoading] = React.useState<boolean>(false);
  const [actionLoading, setActionLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Countdowns
  const [timeRemaining, setTimeRemaining] = React.useState<number>(0); // in seconds
  const [rotationRemaining, setRotationRemaining] = React.useState<number>(0); // in seconds

  // Fetch initial classes, active session, and low attendance overview
  React.useEffect(() => {
    const initDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const [overviewRes, activeSessionRes] = await Promise.all([
          fetch("/api/teachers/me/overview"),
          fetch("/api/qr/active"),
        ]);

        const overviewData = await overviewRes.json();
        const activeSessionData = await activeSessionRes.json();

        if (overviewData.success) {
          setClasses(overviewData.data.classes ?? []);
          setLowAttendanceStudents(overviewData.data.lowAttendanceStudents ?? []);
          setThreshold(overviewData.data.threshold ?? 75);
        }

        if (activeSessionData.success && activeSessionData.data) {
          setActiveSession(activeSessionData.data);
        }
      } catch (err) {
        setError("Failed to load instructor dashboard overview data");
      } finally {
        setLoading(false);
      }
    };

    initDashboard();
  }, []);

  // Poll live attendance roster for active session
  React.useEffect(() => {
    if (!activeSession) {
      setLiveRoster([]);
      setLiveCount(0);
      return;
    }

    const fetchLive = async () => {
      try {
        const res = await fetch(`/api/attendance/session/${activeSession.sessionId}/live`);
        const data = await res.json();
        if (data.success) {
          setLiveRoster(data.data.attendees ?? []);
          setLiveCount(data.data.count ?? 0);
        }
      } catch (e) {
        console.error("Failed polling live attendance roster:", e);
      }
    };

    fetchLive(); // Fetch immediately on state load
    const pollInterval = setInterval(fetchLive, 4000); // Poll every 4 seconds

    return () => clearInterval(pollInterval);
  }, [activeSession]);

  // Fetch subjects when class is selected
  React.useEffect(() => {
    if (!selectedClassId) {
      setSubjects([]);
      setSelectedSubjectId("");
      return;
    }

    const fetchSubjects = async () => {
      setSubjectsLoading(true);
      try {
        const res = await fetch(`/api/subjects?classId=${selectedClassId}`);
        const data = await res.json();
        if (data.success) {
          setSubjects(data.data ?? []);
        }
      } catch (err) {
        console.error("Failed to load subjects", err);
      } finally {
        setSubjectsLoading(false);
      }
    };

    fetchSubjects();
  }, [selectedClassId]);

  // Handle countdown timer & dynamic rotation interval
  React.useEffect(() => {
    if (!activeSession) return;

    // Calculate initial remaining seconds
    const calculateTime = () => {
      const diff = new Date(activeSession.expiresAt).getTime() - Date.now();
      return Math.max(0, Math.floor(diff / 1000));
    };

    setTimeRemaining(calculateTime());
    setRotationRemaining(activeSession.qrRotationSeconds);

    const timer = setInterval(() => {
      const remaining = calculateTime();
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        // Expired on client
        setActiveSession(null);
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession]);

  // Handle client-driven QR token rotation
  React.useEffect(() => {
    if (!activeSession || timeRemaining <= 0) return;

    const rotationInterval = setInterval(async () => {
      setRotationRemaining((prev) => {
        if (prev <= 1) {
          // Trigger rotation
          const rotateToken = async () => {
            try {
              const res = await fetch(`/api/qr/rotate/${activeSession.sessionId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              });
              const data = await res.json();
              if (data.success) {
                setActiveSession((prevSession) =>
                  prevSession
                    ? {
                        ...prevSession,
                        token: data.data.token,
                        qrDataUrl: data.data.qrDataUrl,
                        expiresAt: data.data.expiresAt,
                      }
                    : null
                );
              } else if (data.error?.code === "SESSION_EXPIRED" || data.error?.code === "SESSION_INACTIVE") {
                setActiveSession(null);
              }
            } catch (err) {
              console.error("Failed to rotate QR token", err);
            }
          };
          rotateToken();
          return activeSession.qrRotationSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(rotationInterval);
  }, [activeSession, timeRemaining]);

  const handleStartSession = async () => {
    if (!selectedClassId || !selectedSubjectId) return;

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/qr/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: selectedClassId, subjectId: selectedSubjectId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || "Failed to start attendance session");
      } else {
        // Fetch full active session state to populate names
        const activeRes = await fetch("/api/qr/active");
        const activeData = await activeRes.json();
        if (activeData.success && activeData.data) {
          setActiveSession(activeData.data);
        }
      }
    } catch (err) {
      setError("Network error starting session");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopSession = async () => {
    if (!activeSession) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/qr/stop/${activeSession.sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        setActiveSession(null);
      } else {
        setError(data.error?.message || "Failed to stop session");
      }
    } catch (err) {
      setError("Network error stopping session");
    } finally {
      setActionLoading(false);
    }
  };

  // Helper formatting for countdown MM:SS
  const formatCountdown = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <PageContainer title="Instructor Dashboard" description="Loading portal...">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-[#0f2b48] animate-spin" />
        </div>
      </PageContainer>
    );
  }

  const teacherName = session?.user?.fullName ?? "Instructor";

  return (
    <PageContainer
      title={`Instructor Dashboard — ${teacherName}`}
      description="Access attendance control systems, classes, and student rosters."
      badge={
        <Badge variant="default" className="bg-[#0f2b48] text-white">
          Teacher Portal
        </Badge>
      }
      actions={
        <div className="flex items-center gap-2">
          <Link href="/reports">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileBarChart2 className="w-4 h-4" />
              <span>Reports</span>
            </Button>
          </Link>
          <Link href="/classes">
            <Button variant="primary" size="sm" className="gap-1.5 text-xs">
              <BookOpen className="w-4 h-4" />
              <span>Manage Classes</span>
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Error panel */}
        {error && (
          <div className="flex items-center gap-2.5 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic active session rendering */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {activeSession ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                      Active Attendance Session
                    </h2>
                  </div>
                  <Badge variant="success" className="text-xs gap-1 font-semibold bg-emerald-50 text-emerald-800 border-emerald-200 border">
                    <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                    Rotating QR ({rotationRemaining}s)
                  </Badge>
                </div>

                <Card className="border-2 border-slate-200 overflow-hidden shadow-sm">
                  <CardHeader className="bg-slate-50/80 p-5 border-b border-slate-200/80">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base sm:text-lg text-slate-900 font-bold">
                          {activeSession.className}
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500 font-medium mt-1">
                          Subject: {activeSession.subjectName}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/session/${activeSession.sessionId}`} target="_blank">
                          <Button variant="outline" size="sm" className="gap-1 text-xs">
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>Projector Mode</span>
                          </Button>
                        </Link>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={actionLoading}
                          onClick={handleStopSession}
                          className="gap-1 text-xs"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Stop Session</span>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-center justify-around gap-8">
                      {/* Server-Side QR Renderer */}
                      <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border-2 border-slate-200 shadow-sm max-w-[240px] w-full text-center space-y-3">
                        {activeSession.qrDataUrl ? (
                          <img
                            src={activeSession.qrDataUrl}
                            alt="Attendance QR Code"
                            className="w-48 h-48 rounded-lg shadow-inner object-contain"
                          />
                        ) : (
                          <div className="w-48 h-48 bg-slate-100 flex items-center justify-center rounded-lg">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                          </div>
                        )}
                        <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">
                          Scan to record attendance
                        </span>

                        {/* Direct Session Token display with 1-click copy */}
                        {activeSession.token && (
                          <div className="w-full pt-2 space-y-1 border-t border-slate-100">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block text-left">
                              Classroom Token:
                            </span>
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5">
                              <span className="font-mono text-[10px] text-slate-800 truncate flex-1 text-left select-all">
                                {activeSession.token}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(activeSession.token);
                                  setCopiedToken(true);
                                  setTimeout(() => setCopiedToken(false), 2000);
                                }}
                                className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium flex items-center gap-1 shrink-0 transition-colors"
                                title="Copy session token"
                              >
                                {copiedToken ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-[9px] font-bold text-emerald-600">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-500" />
                                    <span className="text-[9px]">Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Expiry and Session metrics info */}
                      <div className="flex-1 space-y-5 text-center md:text-left w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Session Countdown
                            </span>
                            <div className="flex items-center justify-center md:justify-start gap-2.5">
                              <Clock className="w-5 h-5 text-[#0f2b48]" />
                              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                                {formatCountdown(timeRemaining)}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Students Checked In
                            </span>
                            <div className="flex items-center justify-center md:justify-start gap-2">
                              <Users className="w-5 h-5 text-emerald-600" />
                              <span className="text-2xl font-extrabold text-emerald-600 tracking-tight">
                                {liveCount}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Live check-in roster */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                            Live Roster Checked-In So Far:
                          </h4>
                          <div className="max-h-[140px] overflow-y-auto border border-slate-200 rounded-xl bg-slate-50 divide-y divide-slate-100 text-left">
                            {liveRoster.length === 0 ? (
                              <p className="p-4 text-xs text-slate-400 text-center font-medium">
                                No check-ins logged yet. QR codes are rotating...
                              </p>
                            ) : (
                              liveRoster.map((att: any) => (
                                <div key={att.studentId} className="flex items-center justify-between p-2.5 px-3 hover:bg-slate-100/50 transition-colors">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs font-bold text-slate-900 truncate">
                                        {att.fullName}
                                      </p>
                                      {att.verificationMethod === "face" ? (
                                        <span className="inline-flex items-center text-[9px] font-semibold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.2 rounded">
                                          👤 Face ID {att.faceMatchScore ? `(${att.faceMatchScore}%)` : ""}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center text-[9px] font-medium text-slate-600 bg-slate-200/80 px-1.5 py-0.2 rounded">
                                          📷 QR
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-mono">
                                      Code: {att.studentCode}
                                    </p>
                                  </div>
                                  <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shrink-0">
                                    {new Date(att.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* If no active session, display start launcher */
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Launch Attendance Session
                </h2>
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-950 font-bold">Start Live Attendance QR</CardTitle>
                    <CardDescription className="text-xs">
                      Choose a class and subject to generate a secure, rotating QR projection screen.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {classes.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">
                        You do not have any assigned classes. Please create one to launch a session.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Select Class
                          </label>
                          <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            disabled={actionLoading}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0f2b48] focus:outline-none focus:ring-2 focus:ring-[#0f2b48]/20 disabled:opacity-50"
                          >
                            <option value="">-- Choose Class --</option>
                            {classes.map((cls) => (
                              <option key={cls.id} value={cls.id}>
                                {cls.name} ({cls.academicTerm})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Select Subject
                          </label>
                          <select
                            value={selectedSubjectId}
                            onChange={(e) => setSelectedSubjectId(e.target.value)}
                            disabled={actionLoading || !selectedClassId || subjectsLoading}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0f2b48] focus:outline-none focus:ring-2 focus:ring-[#0f2b48]/20 disabled:opacity-50"
                          >
                            <option value="">
                              {subjectsLoading ? "Loading..." : "-- Choose Subject --"}
                            </option>
                            {subjects.map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <Button
                        variant="primary"
                        disabled={actionLoading || !selectedClassId || !selectedSubjectId}
                        onClick={handleStartSession}
                        className="w-full gap-2 text-xs font-semibold py-2.5"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        <span>Start Attendance Session</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Right sidebar — Low Attendance and Stats */}
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Roster Attendance Warnings</h3>
              <p className="text-xs text-slate-500">Students below required {threshold}% attendance threshold</p>
            </div>
            <Card className="border-slate-200/90 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {lowAttendanceStudents.length === 0 ? (
                  <div className="p-6 py-12 text-center text-xs text-slate-500">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-bold text-slate-900 mb-0.5">All Clear</p>
                    <p>All enrolled students have rates &gt;= {threshold}%.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {lowAttendanceStudents.map((stud: any) => (
                      <div key={`${stud.studentId}-${stud.subjectId}`} className="p-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-start justify-between gap-2 text-left">
                          <div>
                            <p className="text-xs font-bold text-slate-900">{stud.fullName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">Code: {stud.studentCode}</p>
                          </div>
                          <Badge variant="destructive" className="text-[10px] bg-rose-50 text-rose-800 border border-rose-200 shrink-0 font-semibold">
                            {stud.percentage}%
                          </Badge>
                        </div>
                        <div className="mt-2 text-[10px] text-slate-500 border-t border-slate-100/50 pt-2 flex items-center justify-between">
                          <span>{stud.subjectName} ({stud.className})</span>
                          <span className="font-medium text-slate-600">Ratio: {stud.attended} / {stud.held}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
