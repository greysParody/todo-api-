import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  // Never log secrets, even by accident.
  redact: ["password", "currentPassword", "newPassword", "token", "accessToken", "*.password", "*.token"],
  ...(env.NODE_ENV === "development" ? { transport: { target: "pino-pretty", options: { colorize: true } } } : {}),
});
