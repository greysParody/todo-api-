import { clearRefreshCookie } from "@/lib/auth/cookies";
import { requireUser } from "@/lib/auth/require-user";
import { handler, noContent, ok, parseBody } from "@/lib/http";
import { deleteAccountSchema, updateProfileSchema } from "@/schemas/auth";
import * as users from "@/services/user.service";

export const GET = handler(async (req) => {
  const userId = await requireUser(req);
  return ok(await users.getMe(userId));
});

export const PATCH = handler(async (req) => {
  const userId = await requireUser(req);
  const input = await parseBody(req, updateProfileSchema);
  return ok(await users.updateMe(userId, input));
});

export const DELETE = handler(async (req) => {
  const userId = await requireUser(req);
  const { password } = await parseBody(req, deleteAccountSchema);
  await users.deleteMe(userId, password);
  return clearRefreshCookie(noContent());
});
