import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { Errors } from "@/lib/errors";
import type { ChangePasswordInput } from "@/schemas/auth";
import { toPublicUser } from "@/serializers";
import { revokeAllRefreshTokens, sendPasswordChangedEmail } from "./auth.service";

async function getUserOrThrow(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw Errors.unauthorized();
  return user;
}

export async function getMe(userId: string) {
  return toPublicUser(await getUserOrThrow(userId));
}

export async function updateMe(userId: string, input: { name: string }) {
  const user = await db.user.update({ where: { id: userId }, data: { name: input.name } });
  return toPublicUser(user);
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await getUserOrThrow(userId);
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw Errors.validation({ currentPassword: ["Your current password is incorrect."] });
  }

  const passwordHash = await hashPassword(input.newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await revokeAllRefreshTokens(tx, userId);
  });

  await sendPasswordChangedEmail(user.email, user.name);
}

export async function deleteMe(userId: string, password: string) {
  const user = await getUserOrThrow(userId);
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw Errors.validation({ password: ["Your password is incorrect."] });
  }
  // Todos and tokens go with it (ON DELETE CASCADE).
  await db.user.delete({ where: { id: userId } });
}
