import { TeacherClassesClient } from "@/components/teacher/TeacherClassesClient";

export const metadata = {
  title: "Assigned Classes — AttendQR",
  description: "Manage your classes, subjects, and student rosters",
};

export default function TeacherClassesPage() {
  return <TeacherClassesClient />;
}
