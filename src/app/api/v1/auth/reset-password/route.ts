import { handler, ok, parseBody } from "@/lib/http";
import { resetPasswordSchema } from "@/schemas/auth";
import * as auth from "@/services/auth.service";

export const POST = handler(async (req) => {
  const input = await parseBody(req, resetPasswordSchema);
  await auth.resetPassword(input);
  return ok({ message: "Password updated. Log in with your new password." });
});
