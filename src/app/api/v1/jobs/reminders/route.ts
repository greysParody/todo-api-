import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { Errors } from "@/lib/errors";
import { handler, ok } from "@/lib/http";
import { env } from "@/lib/env";
import { sendDueReminders } from "@/services/reminder.service";

function hasJobAuthorization(req: NextRequest) {
  const secret = env.REMINDER_JOB_SECRET;
  const authorization = req.headers.get("authorization") ?? "";
  if (!secret || !authorization.startsWith("Bearer ")) return false;

  const provided = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export const POST = handler(async (req) => {
  if (!env.REMINDER_JOB_SECRET) throw Errors.reminderJobNotConfigured();
  if (!hasJobAuthorization(req)) throw Errors.unauthorizedJob();
  return ok(await sendDueReminders());
});