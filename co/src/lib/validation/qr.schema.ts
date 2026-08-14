import { z } from "zod";

export const startQrSessionSchema = z.object({
  classId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Class ID format"),
  subjectId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Subject ID format"),
}).strict(); // strict rejects unexpected extra fields to prevent injection or parameter pollution
