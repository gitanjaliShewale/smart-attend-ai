"use client";

import * as React from "react";
import { updateStudentProfileSchema } from "@/lib/validation/student.schema";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Pencil,
  X,
  Mail,
  Hash,
  GraduationCap,
} from "lucide-react";
import { StudentFaceEnrollmentCard } from "./StudentFaceEnrollmentCard";

interface StudentProfile {
  studentId: string;
  userId: string;
  studentCode: string;
  fullName: string;
  email: string;
  role: string;
}

export function StudentProfileClient() {
  const [profile, setProfile] = React.useState<StudentProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = React.useState(false);
  const [fullNameDraft, setFullNameDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);

  // Device registration states
  const [deviceRegistered, setDeviceRegistered] = React.useState<boolean>(false);
  const [serverUuid, setServerUuid] = React.useState<string | null>(null);
  const [localUuid, setLocalUuid] = React.useState<string | null>(null);
  const [deviceLoading, setDeviceLoading] = React.useState<boolean>(true);
  const [deviceError, setDeviceError] = React.useState<string | null>(null);

  // Reset device states
  const [showResetForm, setShowResetForm] = React.useState<boolean>(false);
  const [resetPassword, setResetPassword] = React.useState<string>("");
  const [resetting, setResetting] = React.useState<boolean>(false);
  const [resetError, setResetError] = React.useState<string | null>(null);

  const fetchDeviceStatus = React.useCallback(async () => {
    setDeviceLoading(true);
    setDeviceError(null);
    try {
      const res = await fetch("/api/devices/me");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setDeviceError(data.error?.message || "Failed to load device status");
        setDeviceLoading(false);
        return;
      }

      const isRegistered = data.data.registered;
      const serverId = data.data.deviceUuid;
      setDeviceRegistered(isRegistered);
      setServerUuid(serverId);

      let clientUuid = localStorage.getItem("attendqr_device_uuid");
      setLocalUuid(clientUuid);

      if (!isRegistered) {
        // No device registered on the server, auto-register the client
        if (!clientUuid) {
          clientUuid = crypto.randomUUID();
          localStorage.setItem("attendqr_device_uuid", clientUuid);
          setLocalUuid(clientUuid);
        }

        // Register with server
        const regRes = await fetch("/api/devices/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceUuid: clientUuid }),
        });
        const regData = await regRes.json();
        if (!regRes.ok || !regData.success) {
          setDeviceError(regData.error?.message || "Auto-registration failed");
        } else {
          setDeviceRegistered(true);
          setServerUuid(clientUuid);
        }
      }
    } catch {
      setDeviceError("Network error checking device registration");
    } finally {
      setDeviceLoading(false);
    }
  }, []);

  // Fetch profile and device status on mount
  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/students/me");
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error?.message || "Failed to load profile");
        } else {
          setProfile(data.data);
          setFullNameDraft(data.data.fullName);
        }
      } catch {
        setError("Network error. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
    fetchDeviceStatus();
  }, [fetchDeviceStatus]);

  const handleEditCancel = () => {
    setEditing(false);
    setSaveError(null);
    setSaveSuccess(false);
    setFieldError(null);
    if (profile) setFullNameDraft(profile.fullName);
  };

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    setFieldError(null);

    const parsed = updateStudentProfileSchema.safeParse({ fullName: fullNameDraft });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message || "Invalid name");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/students/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: parsed.data.fullName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSaveError(data.error?.message || "Failed to save changes");
      } else {
        setProfile((prev) => prev ? { ...prev, fullName: data.data.fullName } : prev);
        setEditing(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer
        title="Student Profile & Device Security"
        description="Manage account details and active browser device registration."
        maxWidth="narrow"
      >
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-[#0f2b48] animate-spin" />
        </div>
      </PageContainer>
    );
  }

  if (error || !profile) {
    return (
      <PageContainer
        title="Student Profile & Device Security"
        description="Manage account details and active browser device registration."
        maxWidth="narrow"
      >
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error || "Could not load profile."}</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Student Profile & Device Security"
      description="Manage account details and active browser device registration."
      maxWidth="narrow"
    >
      <div className="space-y-6">
        {/* Success toast */}
        {saveSuccess && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Profile updated successfully.</span>
          </div>
        )}

        {/* Profile Details Card */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-[#0f2b48]" />
                Account Details
              </CardTitle>
              {!editing ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => { setEditing(true); setSaveSuccess(false); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Name
                </Button>
              ) : (
                <button
                  onClick={handleEditCancel}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  aria-label="Cancel editing"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <CardDescription className="text-xs">
              Basic identification information managed by your institution.
              Only your display name can be edited.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Full Name — editable */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Full Name
                </label>
                {editing ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={fullNameDraft}
                      onChange={(e) => setFullNameDraft(e.target.value)}
                      disabled={saving}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#0f2b48] focus:outline-none focus:ring-2 focus:ring-[#0f2b48]/20 disabled:opacity-50"
                    />
                    {fieldError && (
                      <p className="text-xs text-rose-600">{fieldError}</p>
                    )}
                  </div>
                ) : (
                  <p className="font-semibold text-slate-900">{profile.fullName}</p>
                )}
              </div>

              {/* Student Code — read-only */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  Student Code
                </label>
                <p className="font-mono font-bold text-slate-900 tracking-widest">{profile.studentCode}</p>
                <p className="text-[11px] text-slate-400">Issued by institution — cannot be changed</p>
              </div>

              {/* Email — read-only */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Institutional Email
                </label>
                <p className="text-slate-700 break-all">{profile.email}</p>
              </div>

              {/* Role — read-only */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" />
                  Role
                </label>
                <p>
                  <Badge variant="secondary" className="capitalize">Student</Badge>
                </p>
              </div>
            </div>

            {/* Save / cancel actions */}
            {editing && (
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                {saveError && (
                  <p className="text-xs text-rose-600 flex-1">{saveError}</p>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <Button variant="outline" size="sm" onClick={handleEditCancel} disabled={saving}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Biometric Face ID Enrollment Card */}
        <StudentFaceEnrollmentCard />

        {/* Device Registration Card — Phase 7 */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#0f2b48]" />
                Registered Device
              </CardTitle>
              {deviceLoading ? (
                <Badge variant="secondary" className="gap-1 text-xs border border-slate-200">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                  Checking Status...
                </Badge>
              ) : deviceError ? (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Registration Error
                </Badge>
              ) : !deviceRegistered ? (
                <Badge variant="secondary" className="gap-1 text-xs border border-slate-200">
                  No Device Registered
                </Badge>
              ) : localUuid === serverUuid ? (
                <Badge variant="success" className="gap-1 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Verified Browser Device
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1 text-xs bg-rose-50 text-rose-800 border border-rose-200">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  Device Mismatch
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Attendance marks are restricted to your registered browser device to prevent proxy scanning.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {deviceLoading ? (
              <div className="flex items-center justify-center p-6">
                <Loader2 className="w-6 h-6 animate-spin text-[#0f2b48]" />
              </div>
            ) : deviceError ? (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{deviceError}</span>
              </div>
            ) : !deviceRegistered ? (
              <div className="p-5 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                <Smartphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-medium text-slate-600">Registering your device...</p>
                <p className="mt-1">Please stand by as we register this browser.</p>
              </div>
            ) : localUuid === serverUuid ? (
              <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200 text-xs text-emerald-950 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">This browser is authorized to mark attendance.</span>
                </div>
                <p className="text-slate-600 font-mono text-[10px] break-all bg-white p-2 rounded border border-slate-100">
                  Device UUID: {serverUuid}
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-amber-50/60 border border-amber-200 text-xs text-amber-950 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Browser Device Mismatch detected.</span>
                    <p className="text-slate-600 mt-1">
                      You are logged in on a browser or device different from your registered one.
                      To register this browser, you must reset your registration.
                    </p>
                  </div>
                </div>
                <p className="text-slate-600 font-mono text-[10px] break-all bg-white p-2 rounded border border-slate-100">
                  Active Server UUID: {serverUuid}
                </p>
              </div>
            )}

            {/* Controlled Reset Section */}
            {deviceRegistered && !deviceLoading && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500 max-w-xs">
                    Need to change devices or browsers? Resetting requires password confirmation.
                  </p>
                  {!showResetForm && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs border-slate-300"
                      onClick={() => { setShowResetForm(true); setResetError(null); setResetPassword(""); }}
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Reset Device</span>
                    </Button>
                  )}
                </div>

                {showResetForm && (
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900">Confirm Device Reset</h4>
                    <p className="text-xs text-slate-500">
                      Enter your password to authorize revoking the old registration. This browser will register immediately afterward.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Re-enter account password"
                        disabled={resetting}
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-[#0f2b48] focus:outline-none focus:ring-2 focus:ring-[#0f2b48]/20 disabled:opacity-50"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={resetting}
                        onClick={async () => {
                          setResetError(null);
                          if (!resetPassword) { setResetError("Password is required"); return; }
                          setResetting(true);
                          try {
                            const res = await fetch("/api/devices/reset", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ password: resetPassword }),
                            });
                            const data = await res.json();
                            if (!res.ok || !data.success) {
                              setResetError(data.error?.message || "Failed to reset device");
                            } else {
                              localStorage.removeItem("attendqr_device_uuid");
                              setShowResetForm(false);
                              await fetchDeviceStatus();
                            }
                          } catch {
                            setResetError("Network error. Please try again.");
                          } finally {
                            setResetting(false);
                          }
                        }}
                      >
                        {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Reset"}
                      </Button>
                    </div>
                    {resetError && <p className="text-xs text-rose-600">{resetError}</p>}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      disabled={resetting}
                      onClick={() => setShowResetForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
