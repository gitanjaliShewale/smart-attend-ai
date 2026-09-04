import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, CheckCircle2 } from "lucide-react";

export default function StudentAttendancePage() {
  const attendanceLogs = [
    {
      id: "1",
      date: "Today, Aug 14, 2026",
      subject: "CS301 Distributed Systems",
      time: "10:14:02 AM",
      instructor: "Dr. Robert Vance",
      status: "present",
    },
    {
      id: "2",
      date: "Aug 13, 2026",
      subject: "CS304 Database Internals",
      time: "02:05:18 PM",
      instructor: "Prof. Sarah Miller",
      status: "present",
    },
    {
      id: "3",
      date: "Aug 12, 2026",
      subject: "MATH240 Linear Algebra",
      time: "09:01:45 AM",
      instructor: "Dr. Evelyn Reed",
      status: "present",
    },
    {
      id: "4",
      date: "Aug 10, 2026",
      subject: "CS301 Distributed Systems",
      time: "10:11:10 AM",
      instructor: "Dr. Robert Vance",
      status: "present",
    },
  ];

  return (
    <PageContainer
      title="Attendance Records"
      description="Historical log of verified class attendance sessions."
      actions={
        <Link href="/dashboard">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Button>
        </Link>
      }
    >
      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Date & Time</th>
                <th className="px-6 py-3.5">Course / Subject</th>
                <th className="px-6 py-3.5">Instructor</th>
                <th className="px-6 py-3.5">Verification</th>
                <th className="px-6 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {attendanceLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{log.date}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{log.time}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800">{log.subject}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{log.instructor}</td>
                  <td className="px-6 py-4 text-xs text-emerald-600 font-medium">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Server Clock Authenticated
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Badge variant="success" className="text-xs uppercase font-bold">
                      Present
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}
