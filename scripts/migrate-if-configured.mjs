// Runs `drizzle-kit migrate` during the Vercel build when a database is attached.
// Skips (instead of failing) when no DATABASE_URL is set, e.g. a preview without a DB.
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
  console.log("[migrate] No DATABASE_URL set, skipping migrations.");
} else {
  console.log("[migrate] Applying database migrations…");
  execSync("npx drizzle-kit migrate", { stdio: "inherit" });
}
