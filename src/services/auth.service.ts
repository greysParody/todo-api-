import { Prisma, TokenType } from "@/generated/prisma/client";
import { getDummyHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { signAccessToken } from "@/lib/auth/jwt";
import { randomToken, sha256 } from "@/lib/auth/tokens";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { PasswordChanged, ResetPassword, VerifyEmail } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { Errors } from "@/lib/errors";
import type { LoginInput, RegisterInput, ResetPasswordInput } from "@/schemas/auth";
import { toPublicUser } from "@/serializers";

const HOUR = 60 * 60 * 1000;
const VERIFY_TTL_MS = 24 * HOUR;
const RESET_TTL_MS = 1 * HOUR;

export type ClientInfo = { ip: string; userAgent: string | null };
type Tx = Prisma.TransactionClient;

// ---------- one-time email tokens (verify + reset) ----------

/** Creates a new one-time token and spends any older unused ones of the same type. Returns the raw token. */
async function issueEmailToken(tx: Tx, userId: string, type: TokenType, ttlMs: number): Promise<string> {
  const now = new Date();
  await tx.verificationToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: now } });
  const raw = randomToken();
  await tx.verificationToken.create({
    data: { userId, type, tokenHash: sha256(raw), expiresAt: new Date(now.getTime() + ttlMs) },
  });
  return raw;
}

/** Marks a one-time token used and returns its user id. The conditional update makes it single-use even under races. */
async function consumeEmailToken(tx: Tx, raw: string, type: TokenType): Promise<string> {
  const row = await tx.verificationToken.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!row || row.type !== type || row.usedAt) throw Errors.invalidToken();
  if (row.expiresAt <= new Date()) throw Errors.tokenExpired();

  const { count } = await tx.verificationToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count === 0) throw Errors.invalidToken();
  return row.userId;
}

const verifyLink = (token: string) => `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
const resetLink = (token: string) => `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;

function sendVerifyEmail(to: string, name: string, token: string) {
  return sendEmail({
    to,
    type: "verify",
    subject: "Verify your email",
    token,
    react: VerifyEmail({ name, url: verifyLink(token) }),
  });
}

export function sendPasswordChangedEmail(to: string, name: string) {
  return sendEmail({
    to,
    type: "notice",
    subject: "Your password was changed",
    react: PasswordChanged({ name, appUrl: env.APP_URL }),
  });
}

// ---------- refresh tokens ----------

async function createRefreshToken(tx: Tx, userId: string, familyId: string, client: ClientInfo) {
  const raw = randomToken();
  const row = await tx.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * HOUR),
      userAgent: client.userAgent?.slice(0, 512) ?? null,
      ip: client.ip,
    },
  });
  return { raw, id: row.id };
}

export async function revokeAllRefreshTokens(tx: Tx, userId: string) {
  await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

// ---------- use cases ----------

export async function register(input: RegisterInput) {
  const passwordHash = await hashPassword(input.password);

  let created;
  try {
    created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: input.name, email: input.email, passwordHash } });
      const token = await issueEmailToken(tx, user.id, TokenType.EMAIL_VERIFY, VERIFY_TTL_MS);
      return { user, token };
    });
  } catch (err) {
    // Unique index on email. Catches the race where two signups pass at the same moment.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw Errors.emailTaken();
    throw err;
  }

  // After commit: a slow or failing Resend call must not hold a lock or roll back the signup.
  await sendVerifyEmail(created.user.email, created.user.name, created.token);
  return toPublicUser(created.user);
}

export async function verifyEmail(token: string) {
  await db.$transaction(async (tx) => {
    const userId = await consumeEmailToken(tx, token, TokenType.EMAIL_VERIFY);
    await tx.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  });
}

export async function resendVerification(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.emailVerifiedAt) return; // Same answer either way, so emails can't be enumerated.

  const token = await db.$transaction((tx) => issueEmailToken(tx, user.id, TokenType.EMAIL_VERIFY, VERIFY_TTL_MS));
  await sendVerifyEmail(user.email, user.name, token);
}

export async function login(input: LoginInput, client: ClientInfo) {
  const user = await db.user.findUnique({ where: { email: input.email } });

  // Always run argon2, so "unknown email" and "wrong password" take the same time.
  const valid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), input.password);
  if (!user || !valid) throw Errors.invalidCredentials();
  if (!user.emailVerifiedAt) throw Errors.emailNotVerified();

  // Each login starts a new token family.
  const refresh = await db.$transaction((tx) => createRefreshToken(tx, user.id, crypto.randomUUID(), client));
  return { accessToken: await signAccessToken(user.id), refreshToken: refresh.raw, user: toPublicUser(user) };
}

type LockedRefreshRow = { id: string; user_id: string; family_id: string; expires_at: Date; revoked_at: Date | null };

/**
 * Rotates a refresh token. Reusing an already-revoked token is treated as theft and kills the whole family.
 * The row lock (FOR UPDATE) stops two parallel refreshes with the same token from both succeeding.
 */
export async function refresh(rawToken: string | undefined, client: ClientInfo) {
  if (!rawToken) throw Errors.invalidRefreshToken();

  // The transaction returns an outcome instead of throwing, so the family revoke commits before we answer 401.
  const outcome = await db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<LockedRefreshRow[]>`
      SELECT id, user_id, family_id, expires_at, revoked_at
      FROM refresh_tokens
      WHERE token_hash = ${sha256(rawToken)}
      FOR UPDATE`;

    if (!row || row.expires_at <= new Date()) return { ok: false as const };

    if (row.revoked_at) {
      await tx.refreshToken.updateMany({
        where: { familyId: row.family_id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { ok: false as const };
    }

    const next = await createRefreshToken(tx, row.user_id, row.family_id, client);
    await tx.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date(), replacedById: next.id } });
    return { ok: true as const, userId: row.user_id, refreshToken: next.raw };
  });

  if (!outcome.ok) throw Errors.invalidRefreshToken();
  return { accessToken: await signAccessToken(outcome.userId), refreshToken: outcome.refreshToken };
}

export async function logout(rawToken: string | undefined) {
  if (!rawToken) return;
  await db.refreshToken.updateMany({ where: { tokenHash: sha256(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function forgotPassword(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return; // Same answer either way.

  const token = await db.$transaction((tx) => issueEmailToken(tx, user.id, TokenType.PASSWORD_RESET, RESET_TTL_MS));
  await sendEmail({
    to: user.email,
    type: "reset",
    subject: "Reset your password",
    token,
    react: ResetPassword({ name: user.name, url: resetLink(token) }),
  });
}

export async function resetPassword(input: ResetPasswordInput) {
  const passwordHash = await hashPassword(input.password);

  const user = await db.$transaction(async (tx) => {
    const userId = await consumeEmailToken(tx, input.token, TokenType.PASSWORD_RESET);
    const current = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const updated = await tx.user.update({
      where: { id: userId },
      // The user just proved they own the inbox, so this also verifies the email.
      data: { passwordHash, emailVerifiedAt: current.emailVerifiedAt ?? new Date() },
    });
    await revokeAllRefreshTokens(tx, userId);
    return updated;
  });

  await sendPasswordChangedEmail(user.email, user.name);
}
