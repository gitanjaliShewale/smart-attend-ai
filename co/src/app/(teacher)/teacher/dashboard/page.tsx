import { TeacherDashboardClient } from "@/components/teacher/TeacherDashboardClient";

export const metadata = {
  title: "Instructor Dashboard — AttendQR",
  description: "Manage live attendance session QR codes and settings",
};

export default function TeacherDashboardPage() {
  return <TeacherDashboardClient />;
}
