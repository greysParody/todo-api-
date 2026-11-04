import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { verifyAccessToken } from "./jwt";

/** Reads the Bearer token and returns the user id. Throws 401 if missing, invalid, or the user is gone. */
export async function requireUser(req: NextRequest): Promise<string> {
  const match = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw Errors.unauthorized();

  const userId = await verifyAccessToken(match[1]);
  const exists = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) throw Errors.unauthorized();
  return userId;
}
