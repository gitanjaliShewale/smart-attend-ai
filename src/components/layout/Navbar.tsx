"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  QrCode,
  GraduationCap,
  BookOpen,
  History,
  User,
  LayoutDashboard,
  FileBarChart2,
  Menu,
  X,
  LogIn,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { NotificationBell } from "./NotificationBell";

export function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const isLoggedIn = status === "authenticated" && !!session?.user;
  const userRole = session?.user?.role;

  // Determine current active section for nav highlights
  const isTeacherView =
    userRole === "teacher" ||
    pathname.startsWith("/teacher") ||
    pathname.startsWith("/classes") ||
    pathname.startsWith("/session") ||
    pathname.startsWith("/reports");

  const studentNavItems = [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: "Scan QR", href: "/scan", icon: <QrCode className="w-4 h-4" /> },
    { label: "Attendance", href: "/attendance", icon: <History className="w-4 h-4" /> },
    { label: "Profile", href: "/profile", icon: <User className="w-4 h-4" /> },
  ];

  const teacherNavItems = [
    { label: "Teacher Dashboard", href: "/teacher/dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: "Classes", href: "/classes", icon: <BookOpen className="w-4 h-4" /> },
    { label: "Reports", href: "/reports", icon: <FileBarChart2 className="w-4 h-4" /> },
    { label: "Profile", href: "/teacher/profile", icon: <User className="w-4 h-4" /> },
  ];

  const activeNavItems = isTeacherView ? teacherNavItems : studentNavItems;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-slate-900 tracking-tight">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f2b48] text-white shadow-xs">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold leading-tight text-[#0f2b48]">AttendQR</span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">
                  Institutional Attendance
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            {isLoggedIn && (
              <nav className="hidden md:flex items-center gap-1">
                {activeNavItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-slate-100 text-[#0f2b48] font-semibold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      )}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Right Action & Session State */}
          <div className="hidden sm:flex items-center gap-3">
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                {userRole === "student" && <NotificationBell />}
                <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-slate-900">
                      {session.user.fullName}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {session.user.email}
                    </span>
                  </div>
                  <Badge
                    variant={userRole === "teacher" ? "default" : "secondary"}
                    className="capitalize text-[10px] gap-1"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    {userRole}
                  </Badge>
                </div>
                <LogoutButton />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Login</span>
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm" className="gap-1.5 text-xs">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Register</span>
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            {isLoggedIn && userRole === "student" && <NotificationBell />}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-3 shadow-lg">
          {isLoggedIn ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900">
                    {session?.user?.fullName}
                  </span>
                  <span className="text-[11px] text-slate-500">{session?.user?.email}</span>
                </div>
                <Badge variant="secondary" className="capitalize text-xs">
                  {userRole}
                </Badge>
              </div>

              <div className="space-y-1">
                {activeNavItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
                        isActive
                          ? "bg-slate-100 text-[#0f2b48] font-bold"
                          : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <LogoutButton className="w-full justify-center" />
              </div>
            </>
          ) : (
            <div className="space-y-2 pt-1">
              <Link href="/login" className="block" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">
                  Login
                </Button>
              </Link>
              <Link href="/register" className="block" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="sm" className="w-full">
                  Register
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
