import type { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

const NAME = "refresh_token";
const BASE = {
  httpOnly: true,
  // Plain http on localhost only.
  secure: env.NODE_ENV !== "development",
  sameSite: "lax" as const,
  path: "/api/v1/auth",
};

export const readRefreshCookie = (req: NextRequest) => req.cookies.get(NAME)?.value;

export function setRefreshCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(NAME, token, { ...BASE, maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 });
  return res;
}

export function clearRefreshCookie(res: NextResponse): NextResponse {
  res.cookies.set(NAME, "", { ...BASE, maxAge: 0 });
  return res;
}
