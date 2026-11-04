import { setRefreshCookie } from "@/lib/auth/cookies";
import { clientInfo, handler, ok, parseBody } from "@/lib/http";
import { RateLimits } from "@/lib/rate-limit";
import { loginSchema } from "@/schemas/auth";
import * as auth from "@/services/auth.service";

export const POST = handler(async (req) => {
  const input = await parseBody(req, loginSchema);
  const client = clientInfo(req);
  await RateLimits.login(client.ip, input.email);
  const { accessToken, refreshToken, user } = await auth.login(input, client);
  return setRefreshCookie(ok({ accessToken, user }), refreshToken);
});
