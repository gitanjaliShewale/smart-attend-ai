"use client";

import * as React from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClassSchema } from "@/lib/validation/class.schema";
import {
  Users, Plus, ArrowRight, Loader2, AlertCircle,
  BookOpen, X, CheckCircle2,
} from "lucide-react";

interface ClassItem {
  id: string;
  name: string;
  academicTerm: string;
  isActive: boolean;
}

export function TeacherClassesClient() {
  const [classes, setClasses] = React.useState<ClassItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  // Create-class modal state
  const [showModal, setShowModal] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = React.useState(false);
  const [name, setName] = React.useState("");
  const [term, setTerm] = React.useState("");
  const [nameErr, setNameErr] = React.useState<string | null>(null);
  const [termErr, setTermErr] = React.useState<string | null>(null);

  const fetchClasses = React.useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/classes");
      const data = await res.json();
      if (data.success) {
        setClasses(data.data ?? []);
      } else {
        setFetchError(data.error?.message || "Failed to load classes");
      }
    } catch {
      setFetchError("Network error. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const resetModal = () => {
    setName(""); setTerm("");
    setNameErr(null); setTermErr(null);
    setCreateError(null); setCreateSuccess(false);
  };

  const handleCreate = async () => {
    setNameErr(null); setTermErr(null); setCreateError(null);

    const parsed = createClassSchema.safeParse({ name, academicTerm: term });
    if (!parsed.success) {
      const errs = parsed.error.format();
      setNameErr(errs.name?._errors[0] ?? null);
      setTermErr(errs.academicTerm?._errors[0] ?? null);
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: parsed.data.name, academicTerm: parsed.data.academicTerm }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCreateError(data.error?.message || "Failed to create class");
      } else {
        setCreateSuccess(true);
        setClasses((prev) => [data.data, ...prev]);
        setTimeout(() => { setShowModal(false); resetModal(); }, 1200);
      }
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageContainer
      title="Assigned Classes"
      description="Manage course subjects, student enrollment rosters, and launch attendance sessions."
      actions={
        <Button variant="primary" size="sm" className="gap-1.5 text-xs" onClick={() => { resetModal(); setShowModal(true); }}>
          <Plus className="w-4 h-4" />
          <span>Create Class</span>
        </Button>
      }
    >
      <>
        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Create New Class</h2>
                <button onClick={() => { setShowModal(false); resetModal(); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close modal">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {createSuccess ? (
                <div className="flex items-center gap-2 text-emerald-700 text-sm py-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  Class created successfully!
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Class Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Distributed Systems"
                      disabled={creating}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0f2b48] focus:outline-none focus:ring-2 focus:ring-[#0f2b48]/20 disabled:opacity-50"
                    />
                    {nameErr && <p className="text-xs text-rose-600">{nameErr}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Academic Term</label>
                    <input
                      type="text"
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                      placeholder="e.g. Fall 2026"
                      disabled={creating}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0f2b48] focus:outline-none focus:ring-2 focus:ring-[#0f2b48]/20 disabled:opacity-50"
                    />
                    {termErr && <p className="text-xs text-rose-600">{termErr}</p>}
                  </div>
                  {createError && (
                    <p className="text-xs text-rose-600 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> {createError}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => { setShowModal(false); resetModal(); }} disabled={creating} className="flex-1">
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleCreate} disabled={creating} className="flex-1">
                      {creating ? (
                        <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating...</span>
                      ) : "Create Class"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Classes grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-[#0f2b48] animate-spin" />
          </div>
        ) : fetchError ? (
          <div className="flex items-center gap-2.5 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            {fetchError}
          </div>
        ) : classes.length === 0 ? (
          <Card className="border-dashed border-slate-300">
            <CardContent className="py-16 text-center">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-600">No classes yet</p>
              <p className="text-xs text-slate-400 mt-1">Click "Create Class" to add your first class.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
              <Card key={cls.id} className="border-slate-200 hover:shadow-md transition-all flex flex-col justify-between">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant={cls.isActive ? "success" : "secondary"} className="text-[11px]">
                      {cls.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="secondary" className="text-[11px]">{cls.academicTerm}</Badge>
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900 mt-2">{cls.name}</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Manage subjects and student roster
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4">
                  <div className="flex items-center justify-between text-xs py-2 border-y border-slate-100">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> Students &amp; Subjects
                    </span>
                    <span className="text-slate-400 text-[11px]">See detail page</span>
                  </div>

                  <Link href={`/classes/${cls.id}`} className="block">
                    <Button variant="outline" size="sm" className="w-full text-xs gap-1">
                      <span>Roster &amp; Detail</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </>
    </PageContainer>
  );
}
