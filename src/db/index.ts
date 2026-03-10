import "dotenv/config";
import { Pool } from "pg";

let pool: Pool | null = null;

export function resetPoolForTesting(): void {
  pool = null;
}

export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required");
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const p = getPool();
    const r = await p.query("SELECT 1");
    return r.rowCount === 1;
  } catch {
    return false;
  }
}
