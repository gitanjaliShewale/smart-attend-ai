import { z } from "zod";

export const createClassSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Class name must be at least 2 characters" })
    .max(100, { message: "Class name cannot exceed 100 characters" }),
  academicTerm: z
    .string()
    .trim()
    .min(2, { message: "Academic term must be at least 2 characters" })
    .max(50, { message: "Academic term cannot exceed 50 characters" }),
});

export const enrollStudentSchema = z.object({
  studentCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, { message: "Student code is required" }),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;
