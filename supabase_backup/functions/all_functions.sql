-- Supabase Functions Export
-- All custom functions from the database

CREATE OR REPLACE FUNCTION public.cleanup_old_realtime_results()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.real_time_results
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$function$;

CREATE OR REPLACE FUNCTION public.deduct_user_credits(p_user_id uuid, p_transaction_type transaction_type, p_search_details jsonb DEFAULT NULL::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_credits INTEGER;
  remaining_credits INTEGER;
  credit_column TEXT;
BEGIN
  -- Determine which credit column to update
  IF p_transaction_type = 'ordinary_search' THEN
    credit_column := 'ordinary_search_credits';
  ELSE
    credit_column := 'long_search_credits';
  END IF;

  -- Get current credits (NULL means unlimited)
  EXECUTE format('SELECT %I FROM public.user_usage_credits WHERE user_id = $1', credit_column)
  INTO current_credits
  USING p_user_id;

  -- If credits is NULL (unlimited), allow the transaction
  IF current_credits IS NULL THEN
    remaining_credits := NULL;
  ELSE
    -- Check if user has enough credits
    IF current_credits < 1 THEN
      RETURN FALSE;
    END IF;

    -- Deduct credit
    remaining_credits := current_credits - 1;

    -- Update the credits
    EXECUTE format('UPDATE public.user_usage_credits SET %I = $1, updated_at = now() WHERE user_id = $2', credit_column)
    USING remaining_credits, p_user_id;
  END IF;

  -- Log the transaction
  INSERT INTO public.usage_transactions (
    user_id,
    transaction_type,
    credits_used,
    remaining_credits,
    search_details
  ) VALUES (
    p_user_id,
    p_transaction_type,
    1,
    remaining_credits,
    p_search_details
  );

  RETURN TRUE;
END;
$function$;

-- Find dataset matches function - main matching logic
CREATE OR REPLACE FUNCTION public.find_dataset_matches_enhanced(search_text text)
 RETURNS TABLE(dataset_name text, organization_name text, match_type text, category text, confidence_score real, last_updated timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Return enhanced matching results with confidence scores
  RETURN QUERY
  SELECT
    d.name as dataset_name,
    de.organization_name,
    CASE
      WHEN LOWER(de.organization_name) = LOWER(search_text) THEN 'exact'
      WHEN EXISTS (
        SELECT 1 FROM unnest(de.aliases) AS alias
        WHERE LOWER(alias) = LOWER(search_text)
      ) THEN 'alias'
      WHEN EXISTS (
        SELECT 1 FROM unnest(de.aliases) AS alias
        WHERE LOWER(search_text) LIKE '%' || LOWER(alias) || '%'
        OR LOWER(alias) LIKE '%' || LOWER(search_text) || '%'
      ) THEN 'alias_partial'
      -- Improved fuzzy matching without similarity function
      WHEN (
        -- Remove spaces and compare (handles "Jiao Tong" vs "Jiaotong")
        LOWER(regexp_replace(de.organization_name, '\s+', '', 'g')) = LOWER(regexp_replace(search_text, '\s+', '', 'g'))
        OR
        -- Use more lenient text matching
        (LENGTH(search_text) > 5 AND LENGTH(de.organization_name) > 5 AND
         (LOWER(de.organization_name) LIKE '%' || LOWER(search_text) || '%'
          OR LOWER(search_text) LIKE '%' || LOWER(de.organization_name) || '%'))
      ) THEN 'fuzzy'
      WHEN LOWER(de.organization_name) LIKE '%' || LOWER(search_text) || '%'
        OR LOWER(search_text) LIKE '%' || LOWER(de.organization_name) || '%' THEN 'partial'
      -- Enhanced matching: remove parentheses and spaces, compare core names
      WHEN (
        LOWER(regexp_replace(regexp_replace(de.organization_name, '\s*\([^)]*\)', '', 'g'), '\s+', '', 'g')) =
        LOWER(regexp_replace(regexp_replace(search_text, '\s*\([^)]*\)', '', 'g'), '\s+', '', 'g'))
      ) THEN 'core_match'
      ELSE 'no_match'
    END as match_type,
    de.category,
    -- Calculate confidence score
    CASE
      WHEN LOWER(de.organization_name) = LOWER(search_text) THEN 1.0
      WHEN EXISTS (
        SELECT 1 FROM unnest(de.aliases) AS alias
        WHERE LOWER(alias) = LOWER(search_text)
      ) THEN 0.95
      WHEN LOWER(regexp_replace(de.organization_name, '\s+', '', 'g')) = LOWER(regexp_replace(search_text, '\s+', '', 'g')) THEN 0.9
      WHEN EXISTS (
        SELECT 1 FROM unnest(de.aliases) AS alias
        WHERE LOWER(search_text) LIKE '%' || LOWER(alias) || '%'
        OR LOWER(alias) LIKE '%' || LOWER(search_text) || '%'
      ) THEN 0.8
      WHEN LOWER(regexp_replace(regexp_replace(de.organization_name, '\s*\([^)]*\)', '', 'g'), '\s+', '', 'g')) =
           LOWER(regexp_replace(regexp_replace(search_text, '\s*\([^)]*\)', '', 'g'), '\s+', '', 'g')) THEN 0.75
      WHEN LOWER(de.organization_name) LIKE '%' || LOWER(search_text) || '%'
        OR LOWER(search_text) LIKE '%' || LOWER(de.organization_name) || '%' THEN 0.6
      ELSE 0.3
    END::real as confidence_score,
    d.updated_at as last_updated
  FROM public.dataset_entries de
  JOIN public.datasets d ON de.dataset_id = d.id
  WHERE
    d.is_active = true
    AND (
      LOWER(de.organization_name) = LOWER(search_text)
      OR EXISTS (
        SELECT 1 FROM unnest(de.aliases) AS alias
        WHERE LOWER(alias) = LOWER(search_text)
        OR LOWER(search_text) LIKE '%' || LOWER(alias) || '%'
        OR LOWER(alias) LIKE '%' || LOWER(search_text) || '%'
      )
      OR LOWER(regexp_replace(de.organization_name, '\s+', '', 'g')) = LOWER(regexp_replace(search_text, '\s+', '', 'g'))
      OR LOWER(de.organization_name) LIKE '%' || LOWER(search_text) || '%'
      OR LOWER(search_text) LIKE '%' || LOWER(de.organization_name) || '%'
      OR LOWER(regexp_replace(regexp_replace(de.organization_name, '\s*\([^)]*\)', '', 'g'), '\s+', '', 'g')) =
         LOWER(regexp_replace(regexp_replace(search_text, '\s*\([^)]*\)', '', 'g'), '\s+', '', 'g'))
    )
  ORDER BY
    confidence_score DESC,
    CASE
      WHEN LOWER(de.organization_name) = LOWER(search_text) THEN 1
      WHEN EXISTS (
        SELECT 1 FROM unnest(de.aliases) AS alias
        WHERE LOWER(alias) = LOWER(search_text)
      ) THEN 2
      ELSE 3
    END;
END;
$function$;

-- Authentication and authorization functions
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = is_admin.user_id AND role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_authenticated()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL;
$function$;

-- User management functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert into profiles with automatic approval for all users
  INSERT INTO public.profiles (id, email, display_name, is_approved, approved_at, approved_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    TRUE, -- Auto-approve all new users
    NOW(), -- Set approval time
    CASE
      WHEN NEW.email = 'fallowearth.ai@gmail.com' THEN NEW.id -- Admin approves themselves
      ELSE NEW.id -- Users auto-approve themselves
    END
  );

  -- Set user roles
  IF NEW.email = 'fallowearth.ai@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$function$;

-- Credits management functions
CREATE OR REPLACE FUNCTION public.initialize_user_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_usage_credits (
    user_id,
    ordinary_search_credits,
    long_search_credits,
    account_type,
    credits_reset_date
  ) VALUES (
    NEW.id,
    CASE
      WHEN NEW.email = 'fallowearth.ai@gmail.com' THEN NULL -- Admin unlimited
      ELSE 250 -- Free trial default credits
    END,
    CASE
      WHEN NEW.email = 'fallowearth.ai@gmail.com' THEN NULL -- Admin unlimited
      ELSE 10 -- Free trial default credits
    END,
    CASE
      WHEN NEW.email = 'fallowearth.ai@gmail.com' THEN 'admin'::public.account_type
      ELSE 'free_trial'::public.account_type
    END,
    NEW.created_at::date -- Set reset date to registration date
  );
  RETURN NEW;
END;
$function$;

-- Utility functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_dataset_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.datasets
  SET updated_at = NOW()
  WHERE id = COALESCE(NEW.dataset_id, OLD.dataset_id);
  RETURN COALESCE(NEW, OLD);
END;
$function$;