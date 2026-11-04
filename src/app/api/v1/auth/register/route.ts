import { clientInfo, handler, ok, parseBody } from "@/lib/http";
import { RateLimits } from "@/lib/rate-limit";
import { registerSchema } from "@/schemas/auth";
import * as auth from "@/services/auth.service";

export const POST = handler(async (req) => {
  await RateLimits.register(clientInfo(req).ip);
  const input = await parseBody(req, registerSchema);
  const user = await auth.register(input);
  return ok({ user }, 201);
});
