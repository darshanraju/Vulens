import { readFileSync } from "fs";
import { join } from "path";
import { getPool } from "./index.js";

async function migrate() {
  const sql = readFileSync(
    join(process.cwd(), "migrations", "001_initial.sql"),
    "utf-8"
  );
  const pool = getPool();
  await pool.query(sql);
  console.log("Applied 001_initial.sql");
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
