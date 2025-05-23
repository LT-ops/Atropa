-- Migration: Create tokens table with constraints and RLS policies

-- 0. Enable pg_trgm extension if not already enabled (for partial/case-insensitive search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Create the tokens table
CREATE TABLE public.tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    symbol text NOT NULL,
    address text NOT NULL UNIQUE,
    parent_id uuid REFERENCES public.tokens(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add constraints
ALTER TABLE public.tokens
    ADD CONSTRAINT tokens_name_symbol_unique UNIQUE (name, symbol);

-- 3. Enable Row Level Security
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Example: Allow all users to SELECT, but only authenticated users to INSERT/UPDATE/DELETE their own tokens
-- (Adjust as needed for your use case)

-- Policy: Allow SELECT to everyone
CREATE POLICY "Allow read access to all"
    ON public.tokens
    FOR SELECT
    USING (true);

-- Policy: Allow INSERT/UPDATE/DELETE only for authenticated users (example, adjust as needed)
CREATE POLICY "Allow write access to authenticated"
    ON public.tokens
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tokens_updated_at
BEFORE UPDATE ON public.tokens
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- 6. Indexes for search performance
CREATE INDEX tokens_name_trgm_idx ON public.tokens USING gin (name gin_trgm_ops);
CREATE INDEX tokens_symbol_trgm_idx ON public.tokens USING gin (symbol gin_trgm_ops);
CREATE INDEX tokens_address_trgm_idx ON public.tokens USING gin (address gin_trgm_ops);

-- 7. Enable pg_trgm extension if not already enabled (for partial/case-insensitive search)
-- (Moved to top of file)