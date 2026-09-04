/**
 * Shared TypeScript type definitions for the QR Attendance System.
 */

export type UserRole = "student" | "teacher";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  studentId?: string;
  teacherId?: string;
}
