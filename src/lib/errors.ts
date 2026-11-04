export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: FieldErrors,
    /** Seconds; becomes the Retry-After header on 429s. */
    public readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export const Errors = {
  validation: (details: FieldErrors) => new AppError(400, "VALIDATION_ERROR", "Some fields are invalid.", details),
  invalidJson: () => new AppError(400, "INVALID_JSON", "Request body must be valid JSON."),
  invalidToken: () => new AppError(400, "INVALID_TOKEN", "This link is invalid or has already been used."),
  tokenExpired: () => new AppError(400, "TOKEN_EXPIRED", "This link has expired. Request a new one."),
  unauthorized: () => new AppError(401, "UNAUTHORIZED", "Missing or expired access token."),
  invalidCredentials: () => new AppError(401, "INVALID_CREDENTIALS", "Incorrect email or password."),
  invalidRefreshToken: () => new AppError(401, "INVALID_REFRESH_TOKEN", "Your session has ended. Please log in again."),
  emailNotVerified: () => new AppError(403, "EMAIL_NOT_VERIFIED", "Please verify your email before logging in."),
  notFound: (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found.`),
  emailTaken: () => new AppError(409, "EMAIL_TAKEN", "An account with this email already exists."),
  rateLimited: (retryAfter: number) =>
    new AppError(429, "RATE_LIMITED", "Too many requests. Please try again later.", undefined, retryAfter),
  dbUnavailable: () => new AppError(503, "DB_UNAVAILABLE", "The database is not reachable."),
};
