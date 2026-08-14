/**
 * Student layout shell — Role-guard to be implemented in Phase 3.
 */
export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Student role-guard and navigation shell will be integrated in Phase 1 & 3 */}
      {children}
    </div>
  );
}
