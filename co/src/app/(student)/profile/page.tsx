import { StudentProfileClient } from "@/components/student/StudentProfileClient";

export const metadata = {
  title: "My Profile — AttendQR",
  description: "Manage your student profile and registered device",
};

export default function StudentProfilePage() {
  return <StudentProfileClient />;
}
