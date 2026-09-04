import { TeacherProjectorClient } from "@/components/teacher/TeacherProjectorClient";

export const metadata = {
  title: "Live Session Projector — AttendQR",
  description: "Dynamic rotating QR code screen for classroom projection",
};

export default async function TeacherSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <TeacherProjectorClient sessionId={sessionId} />;
}
