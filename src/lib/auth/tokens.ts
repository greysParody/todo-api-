import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes, URL safe. Used for refresh, verify and reset tokens. */
export const randomToken = () => randomBytes(32).toString("base64url");

/** What we store in the database. Never store the raw token. */
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
