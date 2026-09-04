import { StudentDashboardClient } from "@/components/student/StudentDashboardClient";

export const metadata = {
  title: "Student Dashboard — AttendQR",
  description: "View your enrolled classes and attendance records",
};

export default function StudentDashboardPage() {
  return <StudentDashboardClient />;
}
