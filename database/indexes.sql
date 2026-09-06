-- Safe performance indexes. Run against the existing Supabase database.
CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_channel ON enquiries(channel);
CREATE INDEX IF NOT EXISTS idx_enquiries_ref ON enquiries(ref);
CREATE INDEX IF NOT EXISTS idx_enquiry_items_enquiry_id ON enquiry_items(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_enquiry_items_product_id ON enquiry_items(product_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
