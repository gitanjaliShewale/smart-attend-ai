"use client";

import * as React from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatBadge } from "@/components/ui/StatBadge";
import { Download, Filter, BookOpen, AlertTriangle, Users, Loader2 } from "lucide-react";

interface ClassItem {
  id: string;
  name: string;
  academicTerm: string;
}

interface SubjectItem {
  id: string;
  name: string;
}

interface StudentSubjectStat {
  subjectId: string;
  subjectName: string;
  held: number;
  attended: number;
  percentage: number;
  noDataYet: boolean;
  belowThreshold: boolean;
}

interface StudentReportRow {
  studentId: string;
  studentCode: string;
  fullName: string;
  subjects: StudentSubjectStat[];
  anyBelowThreshold: boolean;
}

export default function TeacherReportsPage() {
  const [classes, setClasses] = React.useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = React.useState(true);
  const [selectedClassId, setSelectedClassId] = React.useState<string>("");

  const [reportData, setReportData] = React.useState<any>(null);
  const [loadingReport, setLoadingReport] = React.useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>("all");
  const [showBelowThresholdOnly, setShowBelowThresholdOnly] = React.useState(false);

  // Load classes on mount
  React.useEffect(() => {
    fetch("/api/classes")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const list = d.data || [];
          setClasses(list);
          if (list.length > 0) {
            setSelectedClassId(list[0].id);
          }
        }
      })
      .catch((err) => console.error("Failed to load classes:", err))
      .finally(() => setLoadingClasses(false));
  }, []);

  // Fetch report data when selected class changes
  React.useEffect(() => {
    if (!selectedClassId) return;

    setLoadingReport(true);
    fetch(`/api/reports/class/${selectedClassId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setReportData(d.data);
          setSelectedSubjectId("all"); // Reset subject filter on class change
        }
      })
      .catch((err) => console.error("Failed to load report:", err))
      .finally(() => setLoadingReport(false));
  }, [selectedClassId]);

  const handleExportCSV = () => {
    if (!selectedClassId) return;
    window.open(`/api/reports/class/${selectedClassId}/export`, "_blank");
  };

  const subjects: SubjectItem[] = reportData?.subjects || [];
  const students: StudentReportRow[] = reportData?.students || [];
  const threshold = reportData?.threshold ?? 75;

  // Filter students based on UI selections
  const filteredStudents = React.useMemo(() => {
    let result = [...students];

    // Filter by low attendance toggle
    if (showBelowThresholdOnly) {
      result = result.filter((student) => {
        if (selectedSubjectId === "all") {
          return student.anyBelowThreshold;
        } else {
          const subStat = student.subjects.find((s) => s.subjectId === selectedSubjectId);
          return subStat ? subStat.belowThreshold : false;
        }
      });
    }

    return result;
  }, [students, selectedSubjectId, showBelowThresholdOnly]);

  return (
    <PageContainer
      title="Attendance Reports & Export"
      description="Consolidated student attendance rates across course subjects with CSV download."
    >
      <div className="space-y-6">
        {/* Filters Panel */}
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              {/* Class Selector */}
              <div className="flex-1 space-y-1.5 text-left">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Class</label>
                {loadingClasses ? (
                  <div className="h-10 flex items-center px-3 border border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Loading classes...
                  </div>
                ) : (
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0f2b48] cursor-pointer"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.academicTerm})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Subject Filter */}
              <div className="flex-1 space-y-1.5 text-left">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filter Subject</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  disabled={loadingReport || !reportData}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0f2b48] cursor-pointer disabled:opacity-50"
                >
                  <option value="all">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggle Below Threshold */}
              <div className="flex items-center h-10">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={showBelowThresholdOnly}
                    onChange={(e) => setShowBelowThresholdOnly(e.target.checked)}
                    className="rounded border-slate-300 text-[#0f2b48] focus:ring-[#0f2b48] w-4 h-4 cursor-pointer"
                  />
                  <span>Show low-attendance students only ({`< ${threshold}%`})</span>
                </label>
              </div>

              {/* CSV Export */}
              <div>
                <Button
                  onClick={handleExportCSV}
                  disabled={loadingReport || !selectedClassId || students.length === 0}
                  variant="primary"
                  className="h-10 px-5 gap-2 text-xs bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs font-bold w-full md:w-auto"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main report data */}
        {loadingReport ? (
          <div className="flex flex-col items-center justify-center py-20 border border-slate-200 rounded-xl bg-white space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#0f2b48]" />
            <p className="text-xs text-slate-500 font-medium">Analyzing records & calculating percentages...</p>
          </div>
        ) : !selectedClassId ? (
          <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">No classes found</p>
            <p className="mt-1">You must create a class before generating reports.</p>
          </div>
        ) : students.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">No students enrolled</p>
            <p className="mt-1">There are no active enrollments registered for this class.</p>
          </div>
        ) : (
          <Card className="border-slate-200 overflow-hidden shadow-sm">
            <CardHeader className="bg-slate-50/80 p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Roster Standing — {reportData?.class?.name || "Class"}
                </CardTitle>
                <CardDescription className="text-xs">
                  Reviewing attendance rates for term {reportData?.class?.academicTerm}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono text-xs w-fit bg-slate-200 text-slate-800">
                Threshold: {threshold}%
              </Badge>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Student Name</th>
                    <th className="px-6 py-3.5">Student Code</th>
                    <th className="px-6 py-3.5">Subject</th>
                    <th className="px-6 py-3.5">Attended / Held</th>
                    <th className="px-6 py-3.5">Attendance Rate</th>
                    <th className="px-6 py-3.5 text-right">Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-xs text-slate-400">
                        No students match the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      // If a specific subject is filtered, only show that subject row
                      const subjectRows = selectedSubjectId === "all"
                        ? student.subjects
                        : student.subjects.filter((s) => s.subjectId === selectedSubjectId);

                      return subjectRows.map((sub, idx) => (
                        <tr
                          key={`${student.studentId}-${sub.subjectId}`}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            sub.belowThreshold ? "bg-red-50/15" : ""
                          }`}
                        >
                          {/* Span student details on the first row of their set */}
                          {idx === 0 ? (
                            <>
                              <td
                                rowSpan={subjectRows.length}
                                className="px-6 py-4 font-bold text-slate-900 border-r border-slate-100 align-top"
                              >
                                {student.fullName}
                              </td>
                              <td
                                rowSpan={subjectRows.length}
                                className="px-6 py-4 font-mono text-xs text-slate-500 border-r border-slate-100 align-top"
                              >
                                {student.studentCode}
                              </td>
                            </>
                          ) : null}

                          <td className="px-6 py-4 text-xs font-medium text-slate-800">{sub.subjectName}</td>
                          <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                            {sub.held > 0 ? `${sub.attended} / ${sub.held}` : "0 / 0"}
                          </td>
                          <td className="px-6 py-4">
                            <StatBadge percentage={sub.percentage} threshold={threshold} size="sm" />
                          </td>
                          <td className="px-6 py-4 text-right">
                            {sub.noDataYet ? (
                              <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600">
                                No Data
                              </Badge>
                            ) : sub.percentage >= threshold ? (
                              <Badge variant="success" className="text-[10px]">
                                Satisfied
                              </Badge>
                            ) : (
                              <Badge
                                variant="destructive"
                                className="text-[10px] bg-rose-50 border-rose-200 border text-rose-800 gap-0.5"
                              >
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                Low Attendance
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ));
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
