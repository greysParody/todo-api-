import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "@/lib/auth/cookies";
import { AppError } from "@/lib/errors";
import { clientInfo, handler, ok } from "@/lib/http";
import * as auth from "@/services/auth.service";
import { NextResponse } from "next/server";

export const POST = handler(async (req) => {
  try {
    const { accessToken, refreshToken } = await auth.refresh(readRefreshCookie(req), clientInfo(req));
    return setRefreshCookie(ok({ accessToken }), refreshToken);
  } catch (err) {
    if (!(err instanceof AppError) || err.code !== "INVALID_REFRESH_TOKEN") throw err;
    // A dead refresh token also clears the cookie, so the browser stops sending it.
    const res = NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    return clearRefreshCookie(res);
  }
});
