import { z } from "zod";

export const createSubjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Subject name must be at least 2 characters" })
    .max(100, { message: "Subject name cannot exceed 100 characters" }),
  classId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, { message: "Invalid Class ID format" }),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
