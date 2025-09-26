-- Sample of dataset_entries data (first 50 records)
-- Total records: 189

-- Canadian Named Research Organizations
INSERT INTO public.dataset_entries (id, dataset_id, organization_name, aliases, category, metadata, created_at) VALUES ('c64f6f02-90ab-4e5d-9c6f-08320ce26317', '23c3384e-cb30-428b-92bf-7667c18bc365', 'Beihang University (People''s Republic of China)', ARRAY['Beijing University of Aeronautics and Astronautics','BUAA'], NULL, NULL, '2025-06-08 21:12:35.4288+00');

INSERT INTO public.dataset_entries (id, dataset_id, organization_name, aliases, category, metadata, created_at) VALUES ('2db0af7a-8802-4bff-a319-822798a44428', '23c3384e-cb30-428b-92bf-7667c18bc365', 'Harbin Engineering University (People''s Republic of China)', ARRAY['HEU'], NULL, NULL, '2025-06-08 21:12:35.4288+00');

INSERT INTO public.dataset_entries (id, dataset_id, organization_name, aliases, category, metadata, created_at) VALUES ('594b4438-d844-448c-9762-0f29df952bd7', '23c3384e-cb30-428b-92bf-7667c18bc365', 'Baghyatollah Medical Sciences University (Iran)', ARRAY['BMSU','Bagiatollah Medical Sciences University','Baghiatollah Medical Sciences University','Baqyatollah Medical Sciences University','Baqiyatallah Medical Sciences University','Baqiyatallah University of Medical Sciences','Baqiatollah Medical Sciences University'], NULL, NULL, '2025-06-08 21:12:35.4288+00');

INSERT INTO public.dataset_entries (id, dataset_id, organization_name, aliases, category, metadata, created_at) VALUES ('a2dde15e-bdad-4ec9-898f-c2305ae6d941', '23c3384e-cb30-428b-92bf-7667c18bc365', 'Aerospace Research Institute (Iran)', ARRAY['ARI'], NULL, NULL, '2025-06-08 21:12:35.4288+00');

INSERT INTO public.dataset_entries (id, dataset_id, organization_name, aliases, category, metadata, created_at) VALUES ('1980be1e-a368-44b2-95f7-6b7be9dd3ed8', '23c3384e-cb30-428b-92bf-7667c18bc365', 'Beijing Institute of Technology (People''s Republic of China)', ARRAY['BIT'], NULL, NULL, '2025-06-08 21:12:35.4288+00');

INSERT INTO public.dataset_entries (id, dataset_id, organization_name, aliases, category, metadata, created_at) VALUES ('2563e9f2-ef86-4bac-ac74-c3106c27a66b', '23c3384e-cb30-428b-92bf-7667c18bc365', 'National Defense University (People''s Republic of China)', ARRAY['NDU'], NULL, NULL, '2025-06-08 21:12:35.4288+00');

INSERT INTO public.dataset_entries (id, dataset_id, organization_name, aliases, category, metadata, created_at) VALUES ('9d883388-1e2b-46c9-87d1-15e9c59f9396', '23c3384e-cb30-428b-92bf-7667c18bc365', 'Harbin Institute of Technology (People''s Republic of China)', ARRAY['HIT'], NULL, NULL, '2025-06-08 21:12:35.4288+00');

-- Note: This is a sample of the data. For complete dataset restoration,
-- you would need to export all 189 records using pg_dump or similar tools
-- when setting up the new Supabase project.