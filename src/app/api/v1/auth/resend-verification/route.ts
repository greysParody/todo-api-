import { handler, ok, parseBody } from "@/lib/http";
import { RateLimits } from "@/lib/rate-limit";
import { emailOnlySchema } from "@/schemas/auth";
import * as auth from "@/services/auth.service";

export const POST = handler(async (req) => {
  const { email } = await parseBody(req, emailOnlySchema);
  await RateLimits.resendVerification(email);
  await auth.resendVerification(email);
  return ok({ message: "If that account exists and isn't verified, we sent a new link." });
});
