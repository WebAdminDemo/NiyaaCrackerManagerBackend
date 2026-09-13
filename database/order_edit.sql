-- Order editor schema additions. Safe to run more than once.
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS party_sector VARCHAR(150);
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS party_country VARCHAR(100) DEFAULT 'India';
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS party_state VARCHAR(100);
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS party_district VARCHAR(100);
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS party_locality VARCHAR(150);
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS party_pincode VARCHAR(20);
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS brand_mode VARCHAR(20) DEFAULT 'multiBrand';
ALTER TABLE enquiry_items ADD COLUMN IF NOT EXISTS brand VARCHAR(150);
