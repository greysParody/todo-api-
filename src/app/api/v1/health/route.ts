import { db } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { handler, ok } from "@/lib/http";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (err) {
    logger.error({ err }, "health check: database unreachable");
    throw Errors.dbUnavailable();
  }
  return ok({ status: "ok" });
});
