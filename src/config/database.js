import pg from "pg";
const { Pool } = pg;

const useSsl =
  process.env.DATABASE_URL &&
  !/sslmode=disable/i.test(process.env.DATABASE_URL);
const rejectUnauthorized =
  String(process.env.DB_SSL_REJECT_UNAUTHORIZED ?? "false") === "true";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 5),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(
    process.env.DB_CONNECTION_TIMEOUT_MS || 10000,
  ),
  statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 15000),
  ...(useSsl ? { ssl: { rejectUnauthorized } } : {}),
});

pool.on("error", (err) => console.error("PostgreSQL pool error:", err));

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}

export async function healthcheck() {
  await pool.query("SELECT 1");
  return true;
}
