import { requireUser } from "@/lib/auth/require-user";
import { handler, ok, parseBody } from "@/lib/http";
import { changePasswordSchema } from "@/schemas/auth";
import * as users from "@/services/user.service";

export const POST = handler(async (req) => {
  const userId = await requireUser(req);
  const input = await parseBody(req, changePasswordSchema);
  await users.changePassword(userId, input);
  return ok({ message: "Password changed. Log in again with your new password." });
});
