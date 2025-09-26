# Supabase Project Backup & Restoration Guide

This backup was created on **2025-09-25** from the ChainReactions Backend Supabase project.

## 📁 Backup Structure

```
supabase_backup/
├── README.md                    # This file
├── restore_project.sql          # Complete restoration script
├── schema/                      # Database schema files
│   ├── 01_create_datasets_table.sql
│   └── 02_create_dataset_entries_table.sql
├── functions/                   # Database functions
│   └── all_functions.sql        # All custom functions
└── data/                        # Data exports
    ├── datasets.sql             # Datasets table data
    └── dataset_entries_sample.sql  # Sample dataset entries
```

## 🗄️ Database Overview

### Core Tables
- **datasets**: 2 records (Canadian Named Research Organizations, Canadian Listed Terrorist Entities)
- **dataset_entries**: 189 records (Universities, Research Institutes, etc.)
- **profiles**: User profiles and authentication
- **user_roles**: User role management
- **user_usage_credits**: Credit tracking system
- **usage_transactions**: Transaction logging

### Key Functions
- `find_dataset_matches_enhanced()`: Main matching algorithm with confidence scoring
- `deduct_user_credits()`: Credit management system
- `handle_new_user()`: New user registration trigger
- `initialize_user_credits()`: Credit initialization

## 🚀 How to Clone to New Supabase Account

### Step 1: Create New Supabase Project
1. Go to [supabase.com](https://supabase.com) and create new account
2. Create new project
3. Wait for project initialization
4. Note your new project's database URL and keys

### Step 2: Connect to New Database
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your new project
supabase link --project-ref YOUR_NEW_PROJECT_REF

# Or connect directly via SQL editor in Supabase Dashboard
```

### Step 3: Restore Database Structure & Data
```bash
# Option A: Using Supabase SQL Editor
# 1. Open Supabase Dashboard → SQL Editor
# 2. Copy contents of restore_project.sql
# 3. Execute the script

# Option B: Using psql (if you have direct DB access)
psql "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" -f restore_project.sql
```

### Step 4: Complete Data Export (Important!)
The sample data file only contains a few records. For complete restoration:

```sql
-- In your OLD Supabase project, export all dataset_entries
COPY (SELECT * FROM dataset_entries) TO '/tmp/dataset_entries_full.csv' WITH CSV HEADER;

-- In your NEW Supabase project, import the data
COPY dataset_entries FROM '/tmp/dataset_entries_full.csv' WITH CSV HEADER;
```

### Step 5: Update Environment Variables
Update your application's `.env` files with new Supabase credentials:
```bash
SUPABASE_URL=https://YOUR_NEW_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your_new_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_new_service_key
```

## 🔧 Critical Configuration Notes

### Row Level Security (RLS)
- All tables have RLS enabled
- Basic policies are included in restore script
- You may need to adjust policies based on your security requirements

### Extensions Required
- `uuid-ossp` (usually pre-installed)
- `pg_trgm` (for similarity matching - may need manual installation)

### Custom Types
- `app_role`: 'admin', 'user'
- `account_type`: 'admin', 'premium', 'free_trial'
- `transaction_type`: 'ordinary_search', 'long_search'

## 🧪 Testing After Restoration

### 1. Verify Table Structure
```sql
-- Check if all tables exist
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Verify record counts
SELECT COUNT(*) FROM datasets;        -- Should be 2
SELECT COUNT(*) FROM dataset_entries; -- Should be 189 (after full import)
```

### 2. Test Core Function
```sql
-- Test the main matching function
SELECT * FROM find_dataset_matches_enhanced('Aerospace Research Institute');
-- Should return: Aerospace Research Institute (Iran) with high confidence
```

### 3. Test Application Integration
```bash
# Test dataset matching service
curl -X POST http://localhost:3003/api/dataset-matching/match \
  -H "Content-Type: application/json" \
  -d '{"entity": "National Defense University", "match_type": "fuzzy"}'
```

## 🎯 Performance Optimization Opportunities

After restoration, consider these optimizations:

### 1. Database Indexes
```sql
-- Add performance indexes
CREATE INDEX CONCURRENTLY idx_dataset_entries_text_search
ON dataset_entries USING GIN (to_tsvector('english', organization_name));

-- Add trigram indexes for fuzzy matching
CREATE INDEX CONCURRENTLY idx_dataset_entries_name_trgm
ON dataset_entries USING GIN (organization_name gin_trgm_ops);
```

### 2. Query Optimization
- Review and optimize the `find_dataset_matches_enhanced()` function
- Consider materialized views for frequently accessed data
- Implement caching strategies

### 3. Connection Pooling
- Configure pgBouncer or similar for connection pooling
- Optimize connection settings in your application

## 📊 Original Project Statistics

- **Total Tables**: 15 tables
- **Total Functions**: 20+ custom functions
- **Dataset Entries**: 189 organizations across 2 datasets
- **Primary Use Case**: OSINT research and entity relationship analysis
- **Geographic Coverage**: China, Iran, Russia, Canada

## 🚨 Important Notes

1. **Data Privacy**: This backup contains research data - handle according to your privacy policies
2. **API Keys**: Remember to update all API keys in your applications after migration
3. **Testing Required**: Thoroughly test all functionality after restoration
4. **Full Data Export**: The sample data is incomplete - export full dataset_entries for production use

## 🔗 Related Services

This database supports these microservices:
- `dataset_matching` (Port 3003) - Entity matching algorithms
- `entity_search` (Port 3002) - Linkup API integration
- `entity_relations_deepthinking` (Port 3000) - OSINT analysis
- Frontend application (Port 8082) - React interface

## 📞 Support

If you encounter issues during restoration:
1. Check Supabase logs in Dashboard
2. Verify all dependencies are installed
3. Ensure proper permissions on database
4. Test individual components before full integration

---

**Backup Created**: 2025-09-25
**Original Project**: ChainReactions Backend
**Database Size**: ~189 entity records + user management system