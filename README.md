# Niyaa Dashboard API — Spring Boot → Express/Vercel migration

This is the final Node.js/Express migration package assembled from the supplied Spring Boot source and the previously established order API contract.

## Stack
- Node.js 20+
- Express 5
- PostgreSQL (`pg`)
- Supabase PostgreSQL compatible
- Zod validation
- Helmet + CORS + compression + rate limiting
- Decimal.js for money calculations
- Vercel serverless entry: `api/index.js`

## API
### Products
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `PATCH /api/products/:id/status`

### Orders / enquiries
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders`
- `GET /api/enquiries` (compatibility alias)
- `GET /api/enquiries/:id`
- `POST /api/enquiries` (compatibility alias)
- `GET /api/enquiry-items`

### Sales
- `GET /api/sales/orders?from=YYYY-MM-DD&to=YYYY-MM-DD&status=&category=&channel=&search=`
- `GET /api/sales/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&status=&category=&channel=&search=`
- `PATCH /api/sales/orders/:id/status`
- `GET /api/sales/top-customers`

## Local setup
1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL` to the Supabase PostgreSQL connection.
4. Set `FRONTEND_URL` to the exact frontend origin(s).
5. Run:
   `npm install`
6. Start:
   `npm run dev`
7. Test:
   `http://localhost:3000/health`
   `http://localhost:3000/api/products`

## Vercel
Import this repository as a Vercel project. No separate build command is required.

Set these Environment Variables in Vercel:
- `DATABASE_URL`
- `NODE_ENV=production`
- `FRONTEND_URL=https://YOUR-FRONTEND.vercel.app`
- `CORS_CREDENTIALS=true`
- `DB_POOL_MAX=5`
- `DB_IDLE_TIMEOUT_MS=30000`
- `DB_CONNECTION_TIMEOUT_MS=10000`
- `DB_STATEMENT_TIMEOUT_MS=15000`
- `DB_SSL_REJECT_UNAUTHORIZED=false`

Redeploy after changing environment variables.

## Database
This application intentionally does NOT run schema creation automatically. The supplied Spring configuration used Hibernate `ddl-auto=validate`, so the migration assumes the existing Supabase tables already exist.

Run `database/indexes.sql` only if those indexes are not already present.

Required tables/fields are represented by:
- `products`
- `enquiries`
- `enquiry_items`
- `stock_snapshots`

## Important migration behavior
### Product
The supplied Java service:
- uses `rowid` as the ID when provided, otherwise generates a UUID;
- calculates discount amount with HALF_UP rounding to 2 decimals;
- calculates amount as price minus discount;
- defaults currency to INR, tax rate to 0, tags to `[]`, stock quantity to 0, min order quantity to 1, backorder to false, active to true, source to `manual`;
- generates a SKU;
- allows only `in_stock` / `no_stock`;
- clears `contents` when changing status to `no_stock`.

### Sales
The supplied Java service filters orders by date/status/category/channel/search and calculates:
- total revenue
- order count
- item count
- quantity
- distinct customers by phone
- status counts
- category revenue
- daily revenue
- channel distribution
- top 6 products by revenue
- top 5 customers

### Orders
The order transaction locks each product row with PostgreSQL `FOR UPDATE`, checks stock and order quantities, decrements stock, inserts the enquiry, enquiry items and stock snapshots, then commits as one transaction. This prevents concurrent requests from decrementing the same stock incorrectly.

## Security / network
Do not put the database password in the React/Vite frontend or GitHub repository.

`DB_SSL_REJECT_UNAUTHORIZED=false` is included because the local Supabase connection previously produced `SELF_SIGNED_CERT_IN_CHAIN`. If your production Supabase connection verifies successfully with certificate validation enabled, set this variable to `true`.

## Migration audit
The package contains the supplied Java source under `source-reference/` for traceability. The original Spring interfaces/repositories were converted to direct PostgreSQL repositories, JPA transactions to explicit PostgreSQL transactions, Bean Validation to Zod, and `@ControllerAdvice` to Express error middleware.

One limitation is source completeness: no implementation of an `EnquiryService` or notification integration was present in the newly supplied Java files. The order implementation therefore follows the previously established `/api/orders` contract and database model rather than claiming an unseen Java implementation was copied byte-for-byte. Optional notification webhooks are intentionally not required for order persistence.
