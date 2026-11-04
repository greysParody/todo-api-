import { handler, ok, parseBody } from "@/lib/http";
import { RateLimits } from "@/lib/rate-limit";
import { emailOnlySchema } from "@/schemas/auth";
import * as auth from "@/services/auth.service";

export const POST = handler(async (req) => {
  const { email } = await parseBody(req, emailOnlySchema);
  await RateLimits.forgotPassword(email);
  await auth.forgotPassword(email);
  return ok({ message: "If an account exists for that email, we sent a reset link." });
});
