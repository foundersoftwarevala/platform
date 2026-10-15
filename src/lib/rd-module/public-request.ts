import { z } from "zod";

export const REQUEST_TEXT_LIMIT = 50_000;
export const REQUEST_PDF_LIMIT = 10 * 1024 * 1024;
export const RD_TEAM_INBOX = "R&D Team";

export const softwareRequestSchema = z.object({
  submissionId: z.string().uuid(),
  text: z.string().max(REQUEST_TEXT_LIMIT),
});

export const softwareRequestReceiptSchema = z.object({
  requestId: z.string(),
  assignedTo: z.string(),
  confirmation: z.enum(["sent", "queued", "unavailable"]),
  repeated: z.boolean(),
});
export type SoftwareRequestReceipt = z.infer<typeof softwareRequestReceiptSchema>;
