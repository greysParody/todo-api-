import { handler, ok, parseBody } from "@/lib/http";
import { tokenOnlySchema } from "@/schemas/auth";
import * as auth from "@/services/auth.service";

export const POST = handler(async (req) => {
  const { token } = await parseBody(req, tokenOnlySchema);
  await auth.verifyEmail(token);
  return ok({ message: "Email verified. You can log in now." });
});
