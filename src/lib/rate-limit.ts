import { db } from "./db";
import { env } from "./env";
import { Errors } from "./errors";

/** Fixed-window counter in Postgres, one atomic upsert per call. Throws 429 when over the limit. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  if (env.RATE_LIMIT_DISABLED) return;

  const [row] = await db.$queryRaw<{ count: number; reset_at: Date }[]>`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}::int))
    ON CONFLICT (key) DO UPDATE SET
      count    = CASE WHEN rate_limits.reset_at < now() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at < now() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
    RETURNING count, reset_at`;

  if (row.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((row.reset_at.getTime() - Date.now()) / 1000));
    throw Errors.rateLimited(retryAfter);
  }
}

export const RateLimits = {
  register: (ip: string) => rateLimit(`register:${ip}`, 5, 60 * 60),
  login: (ip: string, email: string) => rateLimit(`login:${ip}:${email}`, 10, 15 * 60),
  resendVerification: (email: string) => rateLimit(`resend:${email}`, 3, 60 * 60),
  forgotPassword: (email: string) => rateLimit(`forgot:${email}`, 3, 60 * 60),
};
