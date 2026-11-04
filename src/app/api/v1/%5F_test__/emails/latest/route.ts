import { testOutbox } from "@/lib/email/send";
import { env } from "@/lib/env";
import { Errors } from "@/lib/errors";
import { handler, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Test-only: lets the contract check read verify/reset tokens without a real inbox. */
export const GET = handler(async (req) => {
  if (!env.ENABLE_TEST_ROUTES) throw Errors.notFound();

  const to = req.nextUrl.searchParams.get("to")?.trim().toLowerCase();
  const email = to ? testOutbox.get(to) : undefined;
  if (!email) throw Errors.notFound("Email");
  return ok(email);
});
