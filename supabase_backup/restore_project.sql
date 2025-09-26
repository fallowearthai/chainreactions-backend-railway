-- Supabase Project Restoration Script
-- This script recreates the entire database structure and data

-- ===========================================
-- STEP 1: Create Extensions (if needed)
-- ===========================================
-- Note: Most extensions are available by default in Supabase
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ===========================================
-- STEP 2: Create Enum Types
-- ===========================================
CREATE TYPE app_role AS ENUM ('admin', 'user');
CREATE TYPE account_type AS ENUM ('admin', 'premium', 'free_trial');
CREATE TYPE transaction_type AS ENUM ('ordinary_search', 'long_search');

-- ===========================================
-- STEP 3: Create Core Tables
-- ===========================================

-- Create datasets table
CREATE TABLE datasets (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    is_system boolean NOT NULL DEFAULT false,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE ONLY datasets ADD CONSTRAINT datasets_pkey PRIMARY KEY (id);

-- Create dataset_entries table
CREATE TABLE dataset_entries (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    dataset_id uuid NOT NULL,
    organization_name text NOT NULL,
    aliases text[],
    category text,
    metadata jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE ONLY dataset_entries ADD CONSTRAINT dataset_entries_pkey PRIMARY KEY (id);
ALTER TABLE ONLY dataset_entries ADD CONSTRAINT dataset_entries_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE;

-- Create profiles table
CREATE TABLE profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    display_name text,
    is_approved boolean DEFAULT false,
    approved_at timestamp with time zone,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- Create user_roles table
CREATE TABLE user_roles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Create user_usage_credits table
CREATE TABLE user_usage_credits (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    ordinary_search_credits integer,
    long_search_credits integer,
    account_type account_type NOT NULL DEFAULT 'free_trial',
    credits_reset_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY user_usage_credits ADD CONSTRAINT user_usage_credits_pkey PRIMARY KEY (id);
ALTER TABLE ONLY user_usage_credits ADD CONSTRAINT user_usage_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Create usage_transactions table
CREATE TABLE usage_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    transaction_type transaction_type NOT NULL,
    credits_used integer NOT NULL DEFAULT 1,
    remaining_credits integer,
    search_details jsonb,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY usage_transactions ADD CONSTRAINT usage_transactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY usage_transactions ADD CONSTRAINT usage_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ===========================================
-- STEP 4: Create Indexes
-- ===========================================
CREATE INDEX idx_dataset_entries_dataset_id ON dataset_entries(dataset_id);
CREATE INDEX idx_dataset_entries_organization_name ON dataset_entries(organization_name);
CREATE INDEX idx_dataset_entries_aliases ON dataset_entries USING GIN(aliases);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_usage_transactions_user_id ON usage_transactions(user_id);

-- ===========================================
-- STEP 5: Insert Data
-- ===========================================
-- Insert datasets
\i data/datasets.sql

-- Insert dataset_entries (sample provided - you need to export full data)
\i data/dataset_entries_sample.sql

-- ===========================================
-- STEP 6: Create Functions
-- ===========================================
\i functions/all_functions.sql

-- ===========================================
-- STEP 7: Create Triggers
-- ===========================================
-- Update timestamp trigger
CREATE TRIGGER update_datasets_updated_at
    BEFORE UPDATE ON datasets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dataset_timestamp_trigger
    AFTER INSERT OR UPDATE OR DELETE ON dataset_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_dataset_timestamp();

-- ===========================================
-- STEP 8: Set Row Level Security (RLS)
-- ===========================================
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_transactions ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (you may need to adjust these based on your requirements)
CREATE POLICY "Public datasets are viewable by all users" ON datasets
    FOR SELECT USING (is_active = true);

CREATE POLICY "Dataset entries are viewable by all users" ON dataset_entries
    FOR SELECT USING (true);

CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- ===========================================
-- COMPLETION MESSAGE
-- ===========================================
SELECT 'Supabase project restoration completed successfully!' as status;