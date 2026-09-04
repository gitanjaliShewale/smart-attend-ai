import { StudentScanClient } from "@/components/student/StudentScanClient";

export const metadata = {
  title: "Scan Attendance QR — AttendQR",
  description: "Point your device camera at the rotating QR code projected in your classroom.",
};

export default function StudentScanPage() {
  return <StudentScanClient />;
}
