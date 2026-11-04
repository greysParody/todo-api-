import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";
import { Errors } from "@/lib/errors";

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<string> {
  try {
    // Always pin the algorithm. Without it, some libraries accept alg "none".
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (payload.typ !== "access" || typeof payload.sub !== "string") throw new Error("wrong token type");
    return payload.sub;
  } catch {
    throw Errors.unauthorized();
  }
}
