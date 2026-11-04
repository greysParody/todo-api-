import type { ReactElement } from "react";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const resend = new Resend(env.RESEND_API_KEY);

export type EmailType = "verify" | "reset" | "notice" | "reminder";
type Recorded = { to: string; type: EmailType; subject: string; token: string | null; sentAt: string };

// Kept on globalThis so it survives Next.js dev reloads. Only filled when ENABLE_TEST_ROUTES=true.
const g = globalThis as unknown as { testOutbox?: Map<string, Recorded> };
export const testOutbox = (g.testOutbox ??= new Map<string, Recorded>());

/**
 * Every email goes through here. Never throws: a Resend outage must not break
 * register or reset, the user can press "Resend" later.
 */
export async function sendEmail(input: {
  to: string;
  type: EmailType;
  subject: string;
  react: ReactElement;
  token?: string;
}): Promise<boolean> {
  if (env.ENABLE_TEST_ROUTES) {
    testOutbox.set(input.to, {
      to: input.to,
      type: input.type,
      subject: input.subject,
      token: input.token ?? null,
      sentAt: new Date().toISOString(),
    });
    return true;
  }

  try {
    // Resend returns { data, error } and does not throw on API errors.
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      react: input.react,
    });
    if (error) {
      logger.error({ type: input.type, error }, "email send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ type: input.type, err }, "email send failed");
    return false;
  }
}
