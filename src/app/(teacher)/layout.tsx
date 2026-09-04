/**
 * Teacher layout shell — Role-guard to be implemented in Phase 3.
 */
export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Teacher role-guard and navigation shell will be integrated in Phase 1 & 3 */}
      {children}
    </div>
  );
}
