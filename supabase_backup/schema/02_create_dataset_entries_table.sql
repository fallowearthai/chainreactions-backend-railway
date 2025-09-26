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

-- Add primary key
ALTER TABLE ONLY dataset_entries ADD CONSTRAINT dataset_entries_pkey PRIMARY KEY (id);

-- Add foreign key constraint
ALTER TABLE ONLY dataset_entries ADD CONSTRAINT dataset_entries_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE;