import { randomBytes } from "node:crypto";

process.env.TOKEN_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
process.env.SESSION_SECRET ??= "x".repeat(40);
process.env.DATABASE_URL ??= "postgres://localhost/test";
