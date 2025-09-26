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

-- Add primary key
ALTER TABLE ONLY datasets ADD CONSTRAINT datasets_pkey PRIMARY KEY (id);

-- Add indexes (if any exist)
-- Note: Indexes will be added separately after checking existing ones