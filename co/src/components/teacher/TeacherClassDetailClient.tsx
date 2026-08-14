"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, AlertCircle, Plus, Trash2, BookOpen,
  Users, ChevronLeft, CheckCircle2, X,
} from "lucide-react";

interface ClassDetail {
  class: { id: string; name: string; academicTerm: string; isActive: boolean };
  subjects: { id: string; name: string }[];
  students: { studentId: string; studentCode: string; fullName: string; email: string; enrolledAt: string }[];
}

export function TeacherClassDetailClient() {
  const params = useParams();
  const classId = params?.classId as string;

  const [detail, setDetail] = React.useState<ClassDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  // Add Subject
  const [subjectName, setSubjectName] = React.useState("");
  const [addingSubject, setAddingSubject] = React.useState(false);
  const [subjectError, setSubjectError] = React.useState<string | null>(null);
  const [subjectSuccess, setSubjectSuccess] = React.useState(false);

  // Add Student (by code)
  const [studentCode, setStudentCode] = React.useState("");
  const [addingStudent, setAddingStudent] = React.useState(false);
  const [studentError, setStudentError] = React.useState<string | null>(null);
  const [studentSuccess, setStudentSuccess] = React.useState(false);

  // Drop Student
  const [droppingId, setDroppingId] = React.useState<string | null>(null);

  const fetchDetail = React.useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/classes/${classId}`);
      const data = await res.json();
      if (data.success) setDetail(data.data);
      else setFetchError(data.error?.message || "Failed to load class");
    } catch {
      setFetchError("Network error. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  React.useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleAddSubject = async () => {
    setSubjectError(null);
    const trimmed = subjectName.trim();
    if (trimmed.length < 2) { setSubjectError("Subject name must be at least 2 characters"); return; }
    if (trimmed.length > 100) { setSubjectError("Subject name cannot exceed 100 characters"); return; }
    setAddingSubject(true);
    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, classId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubjectError(data.error?.message || "Failed to add subject");
      } else {
        setDetail((prev) => prev ? { ...prev, subjects: [...prev.subjects, data.data] } : prev);
        setSubjectName("");
        setSubjectSuccess(true);
        setTimeout(() => setSubjectSuccess(false), 2500);
      }
    } catch { setSubjectError("Network error."); }
    finally { setAddingSubject(false); }
  };

  const handleAddStudent = async () => {
    setStudentError(null);
    const code = studentCode.trim().toUpperCase();
    if (code.length < 3) { setStudentError("Student code is required"); return; }
    setAddingStudent(true);
    try {
      const res = await fetch(`/api/classes/${classId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentCode: code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStudentError(data.error?.message || "Failed to enroll student");
      } else {
        setStudentCode("");
        setStudentSuccess(true);
        setTimeout(() => setStudentSuccess(false), 2500);
        fetchDetail(); // Refresh roster
      }
    } catch { setStudentError("Network error."); }
    finally { setAddingStudent(false); }
  };

  const handleDropStudent = async (studentId: string) => {
    setDroppingId(studentId);
    try {
      const res = await fetch(`/api/classes/${classId}/students/${studentId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setDetail((prev) => prev ? {
          ...prev,
          students: prev.students.filter((s) => s.studentId !== studentId),
        } : prev);
      }
    } catch {}
    finally { setDroppingId(null); }
  };

  if (loading) {
    return (
      <PageContainer title="Class Details" description="Loading...">
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-[#0f2b48]" /></div>
      </PageContainer>
    );
  }

  if (fetchError || !detail) {
    return (
      <PageContainer title="Class Details" description="">
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          {fetchError || "Could not load class details."}
        </div>
      </PageContainer>
    );
  }

  const { class: cls, subjects, students } = detail;

  return (
    <PageContainer
      title={cls.name}
      description={`Academic Term: ${cls.academicTerm}`}
      badge={<Badge variant={cls.isActive ? "success" : "secondary"}>{cls.isActive ? "Active" : "Inactive"}</Badge>}
      actions={
        <Link href="/classes">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ChevronLeft className="w-4 h-4" /> Back to Classes
          </Button>
        </Link>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* --- Subjects Panel --- */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#0f2b48]" /> Subjects ({subjects.length})
          </h2>

          {/* Add Subject inline form */}
          <Card className="border-slate-200">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Add Subject</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              {subjectSuccess && (
                <div className="flex items-center gap-1.5 text-emerald-700 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Subject added.
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="Subject name (e.g. Raft Consensus)"
                  disabled={addingSubject}
                  onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-[#0f2b48] focus:outline-none focus:ring-2 focus:ring-[#0f2b48]/20 disabled:opacity-50"
                />
                <Button variant="primary" size="sm" onClick={handleAddSubject} disabled={addingSubject}>
                  {addingSubject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </Button>
              </div>
              {subjectError && <p className="text-xs text-rose-600">{subjectError}</p>}
            </CardContent>
          </Card>

          {/* Subject list */}
          {subjects.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-lg">
              No subjects yet. Add your first subject above.
            </div>
          ) : (
            <div className="space-y-2">
              {subjects.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm">
                  <span className="font-medium text-slate-900">{sub.name}</span>
                  <Badge variant="secondary" className="text-[10px]">Subject</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- Student Roster Panel --- */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0f2b48]" /> Student Roster ({students.length})
          </h2>

          {/* Enroll Student form */}
          <Card className="border-slate-200">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Enroll Student</CardTitle>
              <CardDescription className="text-[11px]">Enter the student code to enroll them in this class.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              {studentSuccess && (
                <div className="flex items-center gap-1.5 text-emerald-700 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Student enrolled.
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  placeholder="Student Code (e.g. STU-1001)"
                  disabled={addingStudent}
                  onKeyDown={(e) => e.key === "Enter" && handleAddStudent()}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono focus:border-[#0f2b48] focus:outline-none focus:ring-2 focus:ring-[#0f2b48]/20 disabled:opacity-50"
                />
                <Button variant="primary" size="sm" onClick={handleAddStudent} disabled={addingStudent}>
                  {addingStudent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </Button>
              </div>
              {studentError && <p className="text-xs text-rose-600">{studentError}</p>}
            </CardContent>
          </Card>

          {/* Roster table */}
          {students.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-lg">
              No students enrolled yet.
            </div>
          ) : (
            <Card className="border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {students.map((stu) => (
                      <tr key={stu.studentId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{stu.fullName}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{stu.studentCode}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-[140px] truncate">{stu.email}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDropStudent(stu.studentId)}
                            disabled={droppingId === stu.studentId}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50"
                            aria-label={`Drop ${stu.fullName}`}
                          >
                            {droppingId === stu.studentId
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <X className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
