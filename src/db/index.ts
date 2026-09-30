import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: DB };

function create(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // `prepare: false` keeps us compatible with transaction-mode poolers (Neon/Supabase pgbouncer).
  const client = postgres(url, { prepare: false, max: 5 });
  return drizzle(client, { schema });
}

/** Lazily-created singleton so importing this module never needs a DB at build time. */
export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    globalForDb.__db ??= create();
    return Reflect.get(globalForDb.__db, prop);
  },
});

export { schema };
