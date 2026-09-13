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

let orderItemBrandSchemaPromise;
let productBrandSchemaPromise;

export function ensureOrderItemBrandSchema() {
  if (!orderItemBrandSchemaPromise) {
    orderItemBrandSchemaPromise = pool
      .query(
        `ALTER TABLE enquiry_items
         ADD COLUMN IF NOT EXISTS brand VARCHAR(150)`,
      )
      .catch((error) => {
        orderItemBrandSchemaPromise = null;
        throw error;
      });
  }

  return orderItemBrandSchemaPromise;
}

export function ensureProductBrandSchema() {
  if (!productBrandSchemaPromise) {
    productBrandSchemaPromise = (async () => {
      await pool.query(
        `ALTER TABLE products
         ADD COLUMN IF NOT EXISTS brand VARCHAR(50),
         ADD COLUMN IF NOT EXISTS brand_status BOOLEAN`,
      );

      await pool.query(
        `UPDATE products
         SET brand = CASE
           WHEN LOWER(TRIM(COALESCE(brand, ''))) IN ('standard', 'standard fireworks') THEN 'Standard'
           WHEN LOWER(TRIM(COALESCE(brand, ''))) IN ('multibrand', 'multi-brand', 'multi brand') THEN 'Multibrand'
           ELSE NULL
         END,
         brand_status = CASE
           WHEN LOWER(TRIM(COALESCE(brand, ''))) IN ('standard', 'standard fireworks') THEN TRUE
           WHEN LOWER(TRIM(COALESCE(brand, ''))) IN ('multibrand', 'multi-brand', 'multi brand') THEN FALSE
           ELSE NULL
         END`,
      );
    })().catch((error) => {
        productBrandSchemaPromise = null;
        throw error;
      });
  }

  return productBrandSchemaPromise;
}
