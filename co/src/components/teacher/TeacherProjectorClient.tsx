"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Clock, RefreshCw, AlertTriangle, Square, Maximize, CheckCircle2, Copy, Check } from "lucide-react";
import Link from "next/link";

interface SessionDetails {
  sessionId: string;
  token: string;
  expiresAt: string;
  qrDataUrl: string;
  qrRotationSeconds: number;
  className: string;
  subjectName: string;
}

export function TeacherProjectorClient({ sessionId }: { sessionId: string }) {
  const [session, setSession] = React.useState<SessionDetails | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = React.useState<number>(0);
  const [rotationRemaining, setRotationRemaining] = React.useState<number>(0);
  const [stopping, setStopping] = React.useState<boolean>(false);
  const [copiedToken, setCopiedToken] = React.useState<boolean>(false);

  // Fetch initial state
  const fetchCurrent = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/qr/${sessionId}/current`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || "Failed to load session details");
      } else {
        setSession(data.data);
      }
    } catch {
      setError("Network error loading session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  React.useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  // Handle countdown Timer
  React.useEffect(() => {
    if (!session) return;

    const calculateTime = () => {
      const diff = new Date(session.expiresAt).getTime() - Date.now();
      return Math.max(0, Math.floor(diff / 1000));
    };

    setTimeRemaining(calculateTime());
    setRotationRemaining(session.qrRotationSeconds);

    const timer = setInterval(() => {
      const remaining = calculateTime();
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        setError("Attendance session has expired");
        setSession(null);
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [session]);

  // Handle QR code token rotation
  React.useEffect(() => {
    if (!session || timeRemaining <= 0) return;

    const rotationInterval = setInterval(async () => {
      setRotationRemaining((prev) => {
        if (prev <= 1) {
          const rotate = async () => {
            try {
              const res = await fetch(`/api/qr/rotate/${sessionId}`, { method: "POST" });
              const data = await res.json();
              if (data.success) {
                setSession((prevSession) =>
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
                setError("Attendance session has expired or stopped");
                setSession(null);
              }
            } catch (err) {
              console.error("Error rotating QR token", err);
            }
          };
          rotate();
          return session.qrRotationSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(rotationInterval);
  }, [session, sessionId, timeRemaining]);

  const handleStop = async () => {
    setStopping(true);
    try {
      const res = await fetch(`/api/qr/stop/${sessionId}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setError("Attendance session was stopped");
        setSession(null);
      } else {
        setError(data.error?.message || "Failed to stop session");
      }
    } catch {
      setError("Network error stopping session");
    } finally {
      setStopping(false);
    }
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-12 h-12 animate-spin text-[#0f2b48]" />
        <p className="mt-4 text-slate-400 text-sm">Loading Projector Screen...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 space-y-6">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-xl font-bold">Session Closed</h2>
          <p className="text-slate-400 text-sm">{error || "The attendance session is no longer active."}</p>
        </div>
        <Link href="/teacher/dashboard">
          <Button variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-900">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-8 select-none">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-900 pb-6 gap-4">
        <div className="space-y-1 text-center md:text-left">
          <Badge className="bg-[#0f2b48] hover:bg-[#0f2b48] text-emerald-400 font-semibold px-3 py-1 border border-emerald-500/20 gap-1.5 text-xs">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live Attendance session
          </Badge>
          <h1 className="text-xl md:text-3xl font-extrabold tracking-tight mt-1">{session.className}</h1>
          <p className="text-slate-400 text-sm">{session.subjectName}</p>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="gap-1 bg-slate-900 text-slate-400 border-slate-800 px-3 py-1.5 text-sm font-semibold">
            <RefreshCw className="w-4.5 h-4.5 animate-spin text-emerald-400" />
            <span>Rotates in {rotationRemaining}s</span>
          </Badge>
          <Button
            variant="destructive"
            size="sm"
            disabled={stopping}
            onClick={handleStop}
            className="gap-1.5 text-xs px-4"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>End Session</span>
          </Button>
        </div>
      </div>

      {/* Centered QR Display */}
      <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-8">
        <Card className="p-8 bg-white border-0 shadow-2xl rounded-3xl max-w-md w-full flex flex-col items-center justify-center space-y-4">
          {session.qrDataUrl ? (
            <img
              src={session.qrDataUrl}
              alt="Projector QR Code"
              className="w-72 h-72 rounded-2xl shadow-inner object-contain"
            />
          ) : (
            <div className="w-72 h-72 bg-slate-100 flex items-center justify-center rounded-2xl">
              <Loader2 className="w-10 h-10 animate-spin text-slate-400" />
            </div>
          )}
          <span className="text-xs font-mono font-bold tracking-widest text-slate-500 uppercase mt-2">
            Dynamic cryptographic code
          </span>

          {/* Session Token Display with Copy Button */}
          {session.token && (
            <div className="w-full pt-3 space-y-1.5 border-t border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Session Code for Manual & Face ID Check-In:
              </span>
              <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 px-3">
                <span className="font-mono text-xs text-slate-800 font-bold truncate flex-1 select-all text-left">
                  {session.token}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(session.token);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors shadow-sm"
                  title="Copy session token"
                >
                  {copiedToken ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[11px] font-bold text-emerald-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[11px]">Copy Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Footer / Timer status */}
      <div className="border-t border-slate-900 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Clock className="w-7 h-7 text-emerald-500" />
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">Remaining Time</p>
            <p className="text-3xl font-black text-slate-100 font-mono leading-none mt-0.5">
              {formatTime(timeRemaining)}
            </p>
          </div>
        </div>

        <div className="text-center md:text-right text-xs text-slate-500 space-y-1">
          <p className="flex items-center gap-1.5 justify-center md:justify-end">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Anti-screenshot rotation activated</span>
          </p>
          <p>Scan using the AttendQR camera view on your student profile dashboard.</p>
        </div>
      </div>
    </div>
  );
}
