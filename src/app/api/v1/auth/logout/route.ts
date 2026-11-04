import { clearRefreshCookie, readRefreshCookie } from "@/lib/auth/cookies";
import { handler, noContent } from "@/lib/http";
import * as auth from "@/services/auth.service";

export const POST = handler(async (req) => {
  await auth.logout(readRefreshCookie(req));
  return clearRefreshCookie(noContent());
});
