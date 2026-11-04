import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";
import { AppError, Errors, type FieldErrors } from "./errors";
import { logger } from "./logger";

type RouteHandler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Wraps every route: request id, logging, and one place that turns errors into the contract's error shape. */
export function handler<C>(fn: RouteHandler<C>): RouteHandler<C> {
  return async (req, ctx) => {
    const requestId = crypto.randomUUID();
    const started = performance.now();
    let res: Response;
    try {
      res = await fn(req, ctx);
    } catch (err) {
      res = errorResponse(err, requestId);
    }
    res.headers.set("X-Request-Id", requestId);
    logger.info({
      requestId,
      method: req.method,
      path: req.nextUrl.pathname,
      status: res.status,
      ms: Math.round(performance.now() - started),
    });
    return res;
  };
}

function errorResponse(err: unknown, requestId: string): NextResponse {
  if (err instanceof AppError) {
    const res = NextResponse.json(
      { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } },
      { status: err.status },
    );
    if (err.retryAfter !== undefined) res.headers.set("Retry-After", String(err.retryAfter));
    return res;
  }
  logger.error({ requestId, err }, "unhandled error");
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } }, { status: 500 });
}

export const ok = (data: unknown, status = 200) => NextResponse.json({ data }, { status });
export const noContent = () => new NextResponse(null, { status: 204 });

function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const details: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "body";
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw Errors.invalidJson();
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw Errors.validation(toFieldErrors(result.error.issues));
  return result.data;
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const result = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!result.success) throw Errors.validation(toFieldErrors(result.error.issues));
  return result.data;
}

/** Who is calling. Saved on refresh tokens and used for rate-limit keys. */
export function clientInfo(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return { ip, userAgent: req.headers.get("user-agent") };
}
