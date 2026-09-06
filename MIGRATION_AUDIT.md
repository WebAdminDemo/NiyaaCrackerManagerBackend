# Migration audit

## Migrated from supplied Spring sources
- Product entity and all product columns
- Enquiry entity and relationships
- EnquiryItem entity
- StockSnapshot entity
- ProductRepository
- EnquiryRepository
- EnquiryItemRepository
- ProductService/ProductServiceImpl behavior
- ProductController endpoints
- EnquiryItemController endpoint
- SalesReportService filtering/analytics/status behavior
- SalesController endpoints
- Product request validation and status validation
- Global exception response style
- CORS behavior from WebConfiguration
- PostgreSQL configuration/pool sizing from application.properties

## Deliberate Node equivalents
- JPA repository methods -> parameterized SQL repository functions
- `@Transactional` -> explicit PostgreSQL `BEGIN/COMMIT/ROLLBACK`
- `FOR UPDATE` -> PostgreSQL row lock during order stock processing
- Bean Validation -> Zod
- `@ControllerAdvice` -> Express error middleware
- Jackson JSON converters -> JSON text parsing/stringifying
- BigDecimal -> Decimal.js
- Spring server -> Express
- Vercel adapter -> `api/index.js`

## Source gap
The newly supplied source set does not include an implementation of `EnquiryService` or a notification service. The package includes a transactional order implementation for the previously established `/api/orders` contract, but it does not claim to reproduce an unseen Java class byte-for-byte.

## Existing database assumption
The Spring configuration used `spring.jpa.hibernate.ddl-auto=validate`; therefore this migration does not create/alter application tables automatically. It expects the existing Supabase PostgreSQL schema to remain the source of truth.
