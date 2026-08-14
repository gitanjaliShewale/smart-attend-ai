"use client";

import * as React from "react";
import { updateTeacherProfileSchema } from "@/lib/validation/teacher.schema";
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
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Pencil,
  X,
  Mail,
  GraduationCap,
  Building2,
} from "lucide-react";

interface TeacherProfile {
  teacherId: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
}

export function TeacherProfileClient() {
  const [profile, setProfile] = React.useState<TeacherProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = React.useState(false);
  const [fullNameDraft, setFullNameDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);

  // Fetch profile on mount
  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/teachers/me");
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
  }, []);

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

    const parsed = updateTeacherProfileSchema.safeParse({ fullName: fullNameDraft });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message || "Invalid name");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/teachers/me", {
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
        title="Instructor Profile Settings"
        description="Manage your professional account details and settings."
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
        title="Instructor Profile Settings"
        description="Manage your professional account details and settings."
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
      title="Instructor Profile Settings"
      description="Manage your professional account details and settings."
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
              Review and update your profile information. Note that email and roles are managed institutionally.
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

              {/* Department — mock / institutional info */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Department
                </label>
                <p className="font-semibold text-slate-900">Department of Computer Science</p>
                <p className="text-[11px] text-slate-400">Institutional assignment</p>
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
                  <Badge variant="default" className="bg-[#0f2b48] text-white capitalize">
                    {profile.role}
                  </Badge>
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

        {/* Security & Access Logs */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0f2b48]" />
                Security Credentials
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Password updates are managed via institutional Single Sign-On (SSO) in this phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-600">
              <p>• Multi-Factor Authentication: **Enforced**</p>
              <p>• Access Privilege Level: **Teacher/Instructor**</p>
              <p>• Connection Status: **Secured Session**</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
